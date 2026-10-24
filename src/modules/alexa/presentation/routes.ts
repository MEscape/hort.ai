import { z } from 'zod';

import type { UnauthorizedAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { parseJson } from '@lib/utils';

/** 24 KiB; Alexa request envelopes are far smaller. */
const MAX_BODY_BYTES = 24_576;
const HTTP = {
  badRequest: 400,
  forbidden: 403,
  payloadTooLarge: 413,
  unsupportedMediaType: 415,
  serviceUnavailable: 503,
} as const;

/** Exact operator-requested test sentence; not a learning response. PlainText uses Alexa's standard voice. */
export const CONNECTION_TEST_SENTENCE = 'ahoi aura ai wäre auch gut gewesen';
const STOP_SENTENCE = 'Tschüss';
const STOP_INTENTS = new Set(['AMAZON.StopIntent', 'AMAZON.CancelIntent']);

const envelopeSchema = z.object({
  version: z.literal('1.0'),
  context: z.object({ System: z.object({ application: z.object({ applicationId: z.string() }) }) }),
  session: z.object({ application: z.object({ applicationId: z.string() }) }).optional(),
  request: z.object({
    type: z.enum(['LaunchRequest', 'IntentRequest', 'SessionEndedRequest']),
    timestamp: z.iso.datetime({ offset: true }),
    locale: z.literal('de-DE').optional(),
    intent: z.object({ name: z.string() }).optional(),
  }),
});
type Envelope = z.infer<typeof envelopeSchema>;

interface ConnectionTestOptions {
  readonly skillId: string | undefined;
  readonly verify: (
    raw: string,
    headers: Record<string, string>,
  ) => AppResultAsync<void, UnauthorizedAppError>;
}

/** Anonymous connectivity probe only. No tutor, profile, persistence or user-id logging. */
export function createConnectionTest(
  options: ConnectionTestOptions,
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
    return respond(envelope.data);
  };
}

function isForSkill(envelope: Envelope, skillId: string): boolean {
  const sessionSkill = envelope.session?.application.applicationId ?? skillId;
  return envelope.context.System.application.applicationId === skillId && sessionSkill === skillId;
}

function respond(envelope: Envelope): Response {
  if (envelope.request.type === 'SessionEndedRequest') {
    return Response.json({ version: '1.0', response: {} });
  }
  const isStop =
    envelope.request.type === 'IntentRequest' &&
    STOP_INTENTS.has(envelope.request.intent?.name ?? '');
  return Response.json({
    version: '1.0',
    response: {
      outputSpeech: { type: 'PlainText', text: isStop ? STOP_SENTENCE : CONNECTION_TEST_SENTENCE },
      shouldEndSession: true,
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
