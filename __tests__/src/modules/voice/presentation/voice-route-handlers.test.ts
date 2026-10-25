// @vitest-environment node
// Route handlers run on Node; happy-dom's Request drops Content-Length.
import { describe, expect, it, vi } from 'vitest';

import { createVoiceRouteHandlers } from '@modules/voice/presentation/http/voice-route-handlers';
import type {
  SignedIn,
  Synthesize,
  Transcribe,
} from '@modules/voice/presentation/http/voice-route-handlers';

import {
  forbiddenError,
  infrastructureError,
  rateLimitedError,
  unauthorizedError,
  validationError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

/** The EBML header a `MediaRecorder` WebM recording starts with. */
const WEBM_HEADER = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);

function handlersWith(
  overrides: { synthesize?: Synthesize; transcribe?: Transcribe; signedIn?: SignedIn } = {},
) {
  const options = {
    signedIn: vi.fn<SignedIn>(overrides.signedIn ?? (() => okAsync(undefined))),
    synthesize: vi.fn<Synthesize>(
      overrides.synthesize ??
        (() => okAsync({ audio: new Uint8Array([0xff, 0xfb]), contentType: 'audio/mpeg' })),
    ),
    transcribe: vi.fn<Transcribe>(overrides.transcribe ?? (() => okAsync({ text: 'Hallo Max' }))),
    onFailure: vi.fn(),
  };
  const routes = createVoiceRouteHandlers({
    onFailure: options.onFailure,
    signedIn: options.signedIn,
  });
  return {
    handlers: {
      speech: (request: Request) => routes.speech(request, options.synthesize),
      transcription: (request: Request) => routes.transcription(request, options.transcribe),
    },
    options,
  };
}

function jsonRequest(body: string, length: string | null = String(body.length)): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (length !== null) {
    headers.set('Content-Length', length);
  }
  return new Request('http://localhost/api/voice/speech', { method: 'POST', body, headers });
}

async function multipartRequest(form: FormData, length?: string): Promise<Request> {
  const encoded = new Response(form);
  const body = await encoded.arrayBuffer();
  return new Request('http://localhost/api/voice/transcription', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': encoded.headers.get('content-type') ?? '',
      'Content-Length': length ?? String(body.byteLength),
    },
  });
}

describe('voice route handlers: speech', () => {
  it('returns the MP3 for a valid body and never lets it be cached', async () => {
    const { handlers, options } = handlersWith();

    const response = await handlers.speech(
      jsonRequest(JSON.stringify({ speakerId: 'max', phrase: 'greeting' })),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/mpeg');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xfb]));
    expect(options.synthesize).toHaveBeenCalledWith({
      speakerId: 'max',
      source: { kind: 'phrase', phrase: 'greeting' },
    });
  });

  it('refuses a body without length or too large before reading it', async () => {
    const { handlers, options } = handlersWith();

    const noLength = await handlers.speech(jsonRequest('{}', null));
    const tooLarge = await handlers.speech(jsonRequest('{}', String(64 * 1024)));

    expect(noLength.status).toBe(413);
    expect(tooLarge.status).toBe(413);
    expect(options.synthesize).not.toHaveBeenCalled();
  });

  it.each([
    'not json',
    '{"speakerId":"Max!","phrase":"greeting"}',
    '{"speakerId":"max"}',
    '{"speakerId":"max","phrase":"solution"}',
    '{"speakerId":"max","phrase":"greeting","ticket":"t"}',
  ])('refuses a malformed body (%s)', async (body) => {
    const { handlers } = handlersWith();

    const response = await handlers.speech(jsonRequest(body));

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'voice.validation_failed' });
  });

  it('refuses words from the client with their own code and never calls the use case', async () => {
    const { handlers, options } = handlersWith();

    const free = await handlers.speech(
      jsonRequest(JSON.stringify({ speakerId: 'max', text: 'Die Lösung ist 12.' })),
    );
    const smuggled = await handlers.speech(
      jsonRequest(
        JSON.stringify({ speakerId: 'max', phrase: 'greeting', text: 'Die Lösung ist 12.' }),
      ),
    );

    for (const response of [free, smuggled]) {
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        code: 'voice.validation_failed',
        fieldErrors: { text: ['voice.validation.free_text_refused'] },
      });
    }
    expect(options.synthesize).not.toHaveBeenCalled();
  });

  it('passes a ticket on for the use case to redeem', async () => {
    const { handlers, options } = handlersWith();

    const response = await handlers.speech(
      jsonRequest(JSON.stringify({ speakerId: 'max', ticket: 'body.signature' })),
    );

    expect(response.status).toBe(200);
    expect(options.synthesize).toHaveBeenCalledWith({
      speakerId: 'max',
      source: { kind: 'ticket', ticket: 'body.signature' },
    });
  });

  it('maps a failed result to its status, headers and body, and reports it', async () => {
    const limited = rateLimitedError('voice.rate_limited', 'Too many.', 42);
    const { handlers, options } = handlersWith({ synthesize: () => errAsync(limited) });

    const response = await handlers.speech(
      jsonRequest(JSON.stringify({ speakerId: 'max', phrase: 'greeting' })),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('42');
    expect(await response.json()).toEqual({
      code: 'voice.rate_limited',
      message: 'Too many.',
      retryAfterSeconds: 42,
    });
    expect(options.onFailure).toHaveBeenCalledWith('synthesize', limited);
  });
});

describe('voice route handlers: transcription', () => {
  it('passes the recording with its bare type and returns the text', async () => {
    const { handlers, options } = handlersWith();
    const form = new FormData();
    form.set('childProfileId', 'child-1');
    form.set('audio', new Blob([WEBM_HEADER], { type: 'audio/webm;codecs=opus' }));

    const response = await handlers.transcription(await multipartRequest(form));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ text: 'Hallo Max' });
    expect(options.transcribe).toHaveBeenCalledWith({
      childProfileId: 'child-1',
      audio: WEBM_HEADER,
      contentType: 'audio/webm',
    });
  });

  it('answers an anonymous caller 401 without reading the recording', async () => {
    const anonymous = unauthorizedError('auth.unauthenticated', 'Sign in.');
    const { handlers, options } = handlersWith({ signedIn: () => errAsync(anonymous) });
    const form = new FormData();
    form.set('childProfileId', 'child-1');
    form.set('audio', new Blob([WEBM_HEADER], { type: 'audio/webm' }));
    const request = await multipartRequest(form);
    const formData = vi.spyOn(request, 'formData');

    const response = await handlers.transcription(request);

    expect(response.status).toBe(401);
    expect(formData).not.toHaveBeenCalled();
    expect(options.transcribe).not.toHaveBeenCalled();
  });

  it('refuses a recording that names no child, before the use case runs', async () => {
    const { handlers, options } = handlersWith();
    const form = new FormData();
    form.set('audio', new Blob([new Uint8Array([1])], { type: 'audio/webm' }));

    const response = await handlers.transcription(await multipartRequest(form));

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      fieldErrors: { childProfileId: ['voice.validation.child_profile_required'] },
    });
    expect(options.transcribe).not.toHaveBeenCalled();
  });

  it('answers a missing consent with its stable code, so the interface falls back to text', async () => {
    const consent = forbiddenError('voice.consent_required', 'Please type instead.');
    const { handlers } = handlersWith({ transcribe: () => errAsync(consent) });
    const form = new FormData();
    form.set('childProfileId', 'child-1');
    form.set('audio', new Blob([new Uint8Array([1])], { type: 'audio/webm' }));

    const response = await handlers.transcription(await multipartRequest(form));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'voice.consent_required' });
  });

  it('refuses an oversized declaration, a missing field and a body that is not multipart', async () => {
    const { handlers, options } = handlersWith();
    const empty = new FormData();
    empty.set('note', 'no audio');

    const tooLarge = await handlers.transcription(
      await multipartRequest(new FormData(), String(5 * 1024 * 1024)),
    );
    const missing = await handlers.transcription(await multipartRequest(empty));
    const notMultipart = await handlers.transcription(jsonRequest('{"audio":"abc"}'));

    expect(tooLarge.status).toBe(413);
    expect(missing.status).toBe(415);
    expect(notMultipart.status).toBe(415);
    expect(options.transcribe).not.toHaveBeenCalled();
  });

  it('maps validation and provider failures', async () => {
    const invalid = validationError('voice.validation_failed', 'The input is invalid.', {
      audio: ['voice.validation.recording_type_unsupported'],
    });
    const quota = infrastructureError('speech.quota_exceeded', 'Quota.', new Error('status 401'));
    const form = new FormData();
    form.set('childProfileId', 'child-1');
    form.set('audio', new Blob([new Uint8Array([1])], { type: 'video/mp4' }));
    const first = handlersWith({ transcribe: () => errAsync(invalid) });
    const second = handlersWith({ transcribe: () => errAsync(quota) });

    const refused = await first.handlers.transcription(await multipartRequest(form));
    const failed = await second.handlers.transcription(await multipartRequest(form));

    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({
      fieldErrors: { audio: ['voice.validation.recording_type_unsupported'] },
    });
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ code: 'speech.quota_exceeded', message: 'Quota.' });
    expect(second.options.onFailure).toHaveBeenCalledWith('transcribe', quota);
  });
});
