import { z } from 'zod';

import type { UnauthorizedAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { parseJson, TimeoutError, withTimeout } from '@lib/utils';

import {
  parseConversationId,
  type ConversationId,
  type TutorConversation,
  type TutorReply,
  type TutorTurn,
} from '../application/contracts/tutor-conversation-model';

import type { TutorIntroduction, TutorVoice } from '../application/contracts/tutor-voice-model';

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

/**
 * Time the tutor's voice may take (synthesis and upload on a cache miss) before the answer falls back to
 * Alexa's voice. Alexa waits 8 s in total; verification (a cold certificate download) and a cold start need
 * the rest.
 */
const VOICE_DEADLINE_MS = 4_000;
/**
 * APL for Audio plays on every Alexa device and needs no interface in the skill manifest, so requests do not
 * list it in `supportedInterfaces` (verified in the simulator); there is nothing to check per device.
 */
const APLA_INTERFACE = 'Alexa.Presentation.APLA';
/** APL for Audio specification version (Amazon: "Currently 0.91"). */
const APLA_VERSION = '0.91';
/** Sent when Alexa could not play a clip (for example an expired URL); notification only, no answer. */
const APLA_RUNTIME_ERROR = 'Alexa.Presentation.APLA.RuntimeError';
const TUTOR_INTROS_TOKEN = 'tutor-intros';

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
    type: z.enum(['LaunchRequest', 'IntentRequest', 'SessionEndedRequest', APLA_RUNTIME_ERROR]),
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
  /**
   * Who greets when the skill opens, in this order. Empty/absent: the launch is an ordinary tutor turn.
   * With a voice each greeting is that tutor's own clip; any one that fails is spoken in Alexa's voice.
   */
  readonly introductions?: readonly TutorIntroduction[];
  /** Speaks tutor replies in the tutor's voice; `null`/absent keeps Alexa's standard voice. */
  readonly voice?: TutorVoice | null;
  readonly voiceDeadlineMs?: number;
  /** Told why a reply fell back to Alexa's voice (an error code or `timeout`); never the text or a URL. */
  readonly onVoiceFallback?: (reason: string) => void;
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
    return respond(envelope.data, options);
  };
}

function isForSkill(envelope: Envelope, skillId: string): boolean {
  const sessionSkill = envelope.session?.application.applicationId ?? skillId;
  return envelope.context.System.application.applicationId === skillId && sessionSkill === skillId;
}

async function respond(envelope: Envelope, options: AlexaEndpointOptions): Promise<Response> {
  const { request } = envelope;
  if (request.type === APLA_RUNTIME_ERROR) {
    options.onVoiceFallback?.('apla_runtime_error');
  }
  if (request.type === 'SessionEndedRequest' || request.type === APLA_RUNTIME_ERROR) {
    return Response.json({ version: '1.0', response: {} });
  }
  const conversationId = parseConversationId(envelope.session?.sessionId ?? request.requestId);
  if (conversationId.isErr()) {
    return failure(HTTP.badRequest, 'invalid_envelope');
  }
  const introductions = options.introductions ?? [];
  if (request.type === 'LaunchRequest' && introductions.length > 0) {
    return introduce(introductions, options);
  }
  const next = route(request, conversationId.value);
  return 'speech' in next ? speak(next) : answer(next, options);
}

/** One tutor turn; the reply in the tutor's voice when possible, else in Alexa's. Never fails. */
async function answer(turn: TutorTurn, options: AlexaEndpointOptions): Promise<Response> {
  const reply = await options.tutor.respond(turn);
  if (reply.isErr()) {
    return speak(TUTOR_FAILED_REPLY);
  }
  const { voice } = options;
  const audioUrl = voice ? await voiced(() => voice.audioUrl(reply.value.speech), options) : null;
  return audioUrl === null ? speak(reply.value) : speakAudio(reply.value, audioUrl);
}

/**
 * Every tutor greets in turn, each in its own voice: all clips are fetched in parallel under one
 * deadline (cached after the first launch). A greeting without its clip is spoken in Alexa's voice;
 * without any clip the whole launch is plain text. The conversation then ends, as before.
 */
async function introduce(
  introductions: readonly TutorIntroduction[],
  options: AlexaEndpointOptions,
): Promise<Response> {
  const { voice } = options;
  const reply: TutorReply = {
    speech: introductions.map((intro) => intro.text).join(' '),
    conversation: 'closed',
  };
  if (!voice) {
    return speak(reply);
  }
  const urls = await Promise.all(
    introductions.map((intro) => voiced(() => voice.greetingUrl(intro.tutorId), options)),
  );
  if (urls.every((url) => url === null)) {
    return speak(reply);
  }
  const items = introductions.map((intro, index) => {
    const url = urls[index];
    return url ? { type: 'Audio', source: url } : { type: 'Speech', content: intro.text };
  });
  return renderAudio(reply, { type: 'Sequencer', items }, TUTOR_INTROS_TOKEN);
}

/** A clip URL within the deadline, or `null` for Alexa's own voice. Never fails. */
async function voiced(
  load: () => AppResultAsync<string>,
  options: AlexaEndpointOptions,
): Promise<string | null> {
  const { onVoiceFallback } = options;
  try {
    const url = await withTimeout(
      Promise.resolve(load()),
      options.voiceDeadlineMs ?? VOICE_DEADLINE_MS,
    );
    if (url.isOk()) {
      return url.value;
    }
    onVoiceFallback?.(url.error.code);
  } catch (thrown) {
    onVoiceFallback?.(thrown instanceof TimeoutError ? 'timeout' : 'unexpected');
  }
  return null;
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

/**
 * The reply as an audio clip (APL for Audio: mp3 up to 48 kHz from a public HTTPS URL). An open
 * conversation re-prompts with the same text in Alexa's voice when the child stays silent.
 */
function speakAudio(reply: TutorReply, audioUrl: string): Response {
  return renderAudio(reply, { type: 'Audio', source: audioUrl }, 'tutor-voice');
}

/** One APL for Audio document whose main template plays `item` (a clip, or a sequence of parts). */
function renderAudio(reply: TutorReply, item: Record<string, unknown>, token: string): Response {
  const isOpen = reply.conversation === 'open';
  return Response.json({
    version: '1.0',
    response: {
      directives: [
        {
          type: `${APLA_INTERFACE}.RenderDocument`,
          token,
          document: {
            type: 'APLA',
            version: APLA_VERSION,
            mainTemplate: { item },
          },
        },
      ],
      ...(isOpen ? { reprompt: { outputSpeech: { type: 'PlainText', text: reply.speech } } } : {}),
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
