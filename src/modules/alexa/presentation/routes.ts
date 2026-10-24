import { z } from 'zod';

import type { UnauthorizedAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { parseJson } from '@lib/utils';

import {
  parseConversationId,
  type ConversationId,
  type TutorConversation,
  type TutorReply,
  type TutorTurn,
} from '../application/contracts/tutor-conversation-model';

/** 24 KiB; Alexa request envelopes are far smaller. */
const MAX_BODY_BYTES = 24_576;
const MAX_UTTERANCE_LENGTH = 1_000;
const HTTP = {
  badRequest: 400,
  forbidden: 403,
  payloadTooLarge: 413,
  unsupportedMediaType: 415,
  serviceUnavailable: 503,
} as const;

/** Intent and slot names of alexa/skill-package/interactionModels/custom/de-DE.json. */
const FREE_INPUT_INTENT = 'FreieEingabeIntent';
const FREE_INPUT_SLOT = 'eingabe';
const STOP_INTENTS = new Set([
  'AMAZON.StopIntent',
  'AMAZON.CancelIntent',
  'AMAZON.NavigateHomeIntent',
]);

/** Channel phrases only (no tutoring): ending, help and not-understood prompts of the voice channel. */
const STOP_SENTENCE = 'Tschüss';
const HELP_SENTENCE = 'Sag mir einfach, was du fragen oder antworten möchtest.';
const NOT_UNDERSTOOD_SENTENCE = 'Das habe ich nicht verstanden. Sag es bitte noch einmal.';
const TUTOR_FAILED_SENTENCE =
  'Da ist gerade etwas schiefgelaufen. Versuch es bitte gleich noch einmal.';

const envelopeSchema = z.object({
  version: z.literal('1.0'),
  context: z.object({ System: z.object({ application: z.object({ applicationId: z.string() }) }) }),
  session: z
    .object({
      sessionId: z.string(),
      application: z.object({ applicationId: z.string() }),
    })
    .optional(),
  request: z.object({
    type: z.enum(['LaunchRequest', 'IntentRequest', 'SessionEndedRequest']),
    requestId: z.string(),
    timestamp: z.iso.datetime({ offset: true }),
    locale: z.literal('de-DE').optional(),
    intent: z
      .object({
        name: z.string(),
        slots: z
          .record(z.string(), z.object({ value: z.string().max(MAX_UTTERANCE_LENGTH).optional() }))
          .optional(),
      })
      .optional(),
  }),
});
type Envelope = z.infer<typeof envelopeSchema>;

interface AlexaEndpointOptions {
  readonly skillId: string | undefined;
  readonly verify: (
    raw: string,
    headers: Record<string, string>,
  ) => AppResultAsync<void, UnauthorizedAppError>;
  readonly tutor: TutorConversation;
}

/**
 * Alexa voice channel: verifies the request, maps it onto one tutor turn and the reply back to Alexa speech.
 * Anonymous by design: no profile, persistence or user-id logging; Alexa's ephemeral session id is the only context.
 */
export function createAlexaEndpoint(
  options: AlexaEndpointOptions,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const { skillId } = options;
    if (!skillId) {
      return failure(HTTP.serviceUnavailable, 'alexa_not_configured');
    }
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return failure(HTTP.unsupportedMediaType, 'unsupported_media_type');
    }
    const raw = await readBoundedBody(request);
    if (raw === undefined) {
      return failure(HTTP.payloadTooLarge, 'payload_too_large');
    }
    const verified = await options.verify(raw, Object.fromEntries(request.headers.entries()));
    if (verified.isErr()) {
      return failure(HTTP.badRequest, 'invalid_alexa_request');
    }
    const envelope = envelopeSchema.safeParse(readJson(raw));
    if (!envelope.success) {
      return failure(HTTP.badRequest, 'invalid_envelope');
    }
    if (!isForSkill(envelope.data, skillId)) {
      return failure(HTTP.forbidden, 'wrong_skill');
    }
    return respond(envelope.data, options.tutor);
  };
}

function isForSkill(envelope: Envelope, skillId: string): boolean {
  const sessionSkill = envelope.session?.application.applicationId ?? skillId;
  return envelope.context.System.application.applicationId === skillId && sessionSkill === skillId;
}

async function respond(envelope: Envelope, tutor: TutorConversation): Promise<Response> {
  const { request } = envelope;
  if (request.type === 'SessionEndedRequest') {
    return Response.json({ version: '1.0', response: {} });
  }
  const conversationId = parseConversationId(envelope.session?.sessionId ?? request.requestId);
  if (conversationId.isErr()) {
    return failure(HTTP.badRequest, 'invalid_envelope');
  }
  const next = route(request, conversationId.value);
  if ('speech' in next) {
    return speak(next);
  }
  const reply = await tutor.respond(next);
  return speak(reply.unwrapOr(TUTOR_FAILED_REPLY));
}

/** Either a tutor turn, or a reply the channel gives itself (stop, help, nothing understood). */
function route(
  request: Envelope['request'],
  conversationId: ConversationId,
): TutorTurn | TutorReply {
  if (request.type === 'LaunchRequest') {
    return { conversationId, utterance: null, locale: 'de-DE' };
  }
  const intent = request.intent?.name ?? '';
  if (STOP_INTENTS.has(intent)) {
    return { speech: STOP_SENTENCE, conversation: 'closed' };
  }
  if (intent === 'AMAZON.HelpIntent') {
    return { speech: HELP_SENTENCE, conversation: 'open' };
  }
  const utterance = request.intent?.slots?.[FREE_INPUT_SLOT]?.value?.trim();
  if (intent === FREE_INPUT_INTENT && utterance) {
    return { conversationId, utterance, locale: 'de-DE' };
  }
  return { speech: NOT_UNDERSTOOD_SENTENCE, conversation: 'open' };
}

const TUTOR_FAILED_REPLY: TutorReply = { speech: TUTOR_FAILED_SENTENCE, conversation: 'closed' };

/** PlainText keeps Alexa's standard voice; an open conversation re-prompts with the same text. */
function speak(reply: TutorReply): Response {
  const outputSpeech = { type: 'PlainText', text: reply.speech };
  const isOpen = reply.conversation === 'open';
  return Response.json({
    version: '1.0',
    response: {
      outputSpeech,
      ...(isOpen ? { reprompt: { outputSpeech } } : {}),
      shouldEndSession: !isOpen,
    },
  });
}

function readJson(raw: string): unknown {
  try {
    return parseJson(raw);
  } catch {
    return undefined;
  }
}

function failure(status: number, code: string): Response {
  return Response.json({ error: { code } }, { status });
}

async function readBoundedBody(request: Request): Promise<string | undefined> {
  const reader = request.body?.getReader();
  if (!reader) {
    return '';
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    size += chunk.value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(chunk.value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
