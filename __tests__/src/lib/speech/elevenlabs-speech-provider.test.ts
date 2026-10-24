import { describe, expect, it, vi } from 'vitest';

import { SPEECH_ERROR_CODES } from '@lib/speech';
import { ElevenLabsSpeechProvider } from '@lib/speech/elevenlabs-speech-provider';

/** A placeholder, never a real key: tests never reach the network. */
const API_KEY = 'k'.repeat(32);

function providerWith(answer: (url: string, init: RequestInit) => Promise<Response>) {
  const send = vi.fn(answer);
  const provider = new ElevenLabsSpeechProvider({
    apiKey: API_KEY,
    apiUrl: 'https://api.example.test/',
    ttsModelId: 'eleven_multilingual_v2',
    sttModelId: 'scribe_v1',
    timeoutMs: 1000,
    fetch: send as unknown as typeof fetch,
  });
  return { provider, send };
}

const mp3 = () => new Response(new Uint8Array([0xff, 0xfb, 0x90, 0x00]), { status: 200 });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const recording = {
  audio: new Uint8Array([1, 2, 3]),
  contentType: 'audio/webm',
  languageCode: 'deu',
};

describe('ElevenLabsSpeechProvider.synthesize', () => {
  it('posts the text with the model to the voice and returns the MP3', async () => {
    const { provider, send } = providerWith(() => Promise.resolve(mp3()));

    const result = await provider.synthesize({ text: 'Hallo!', voiceId: 'Voice123' });

    expect(result._unsafeUnwrap()).toEqual({
      audio: new Uint8Array([0xff, 0xfb, 0x90, 0x00]),
      contentType: 'audio/mpeg',
    });
    const [url, init] = send.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://api.example.test/v1/text-to-speech/Voice123?output_format=mp3_44100_128',
    );
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'xi-api-key': API_KEY, Accept: 'audio/mpeg' });
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
      text: 'Hallo!',
      model_id: 'eleven_multilingual_v2',
    });
  });

  it('never puts a malformed voice id into the URL', async () => {
    const { provider, send } = providerWith(() => Promise.resolve(mp3()));

    const result = await provider.synthesize({ text: 'Hallo', voiceId: '../v1/user' });

    expect(result._unsafeUnwrapErr().code).toBe(SPEECH_ERROR_CODES.rejected);
    expect(send).not.toHaveBeenCalled();
  });

  it('treats an empty or unreadable answer as unavailable', async () => {
    const empty = providerWith(() =>
      Promise.resolve(new Response(new Uint8Array(), { status: 200 })),
    );
    const broken = providerWith(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.reject(new TypeError('body stream already read')),
      } as unknown as Response),
    );

    const first = await empty.provider.synthesize({ text: 'Hallo', voiceId: 'Voice123' });
    const second = await broken.provider.synthesize({ text: 'Hallo', voiceId: 'Voice123' });

    expect(first._unsafeUnwrapErr().code).toBe(SPEECH_ERROR_CODES.unavailable);
    expect(second._unsafeUnwrapErr().code).toBe(SPEECH_ERROR_CODES.unavailable);
  });

  it.each([
    [402, { detail: { status: 'paid_plan_required' } }, SPEECH_ERROR_CODES.quotaExceeded],
    [401, { detail: { status: 'quota_exceeded' } }, SPEECH_ERROR_CODES.quotaExceeded],
    [429, { detail: { status: 'too_many_concurrent_requests' } }, SPEECH_ERROR_CODES.throttled],
    [503, { detail: 'busy' }, SPEECH_ERROR_CODES.unavailable],
    [408, {}, SPEECH_ERROR_CODES.unavailable],
    [401, { detail: { status: 'invalid_api_key' } }, SPEECH_ERROR_CODES.rejected],
    [404, { detail: {} }, SPEECH_ERROR_CODES.rejected],
  ])('sorts status %i (%j) as %s', async (status, body, code) => {
    const { provider } = providerWith(() => Promise.resolve(json(body, status)));

    const error = (
      await provider.synthesize({ text: 'Hallo', voiceId: 'Voice123' })
    )._unsafeUnwrapErr();

    expect(error.code).toBe(code);
    expect(String(error.cause)).toContain(`status ${status}`);
  });

  it('keeps an error body that is not JSON out of the cause, and never the key', async () => {
    const { provider } = providerWith(() =>
      Promise.resolve(new Response('<html>Bad Gateway</html>', { status: 400 })),
    );

    const error = (
      await provider.synthesize({ text: 'Hallo', voiceId: 'Voice123' })
    )._unsafeUnwrapErr();

    expect(error.code).toBe(SPEECH_ERROR_CODES.rejected);
    expect(String(error.cause)).toBe('Error: ElevenLabs text-to-speech failed with status 400');
    expect(JSON.stringify(error)).not.toContain(API_KEY);
  });

  it('reports a call that never completed as unavailable, naming only the error type', async () => {
    const timedOut = providerWith(() =>
      Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')),
    );
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- a non-Error rejection is what this case exercises
    const odd = providerWith(() => Promise.reject('connection reset'));

    const first = (
      await timedOut.provider.synthesize({ text: 'Hallo', voiceId: 'Voice123' })
    )._unsafeUnwrapErr();
    const second = (
      await odd.provider.synthesize({ text: 'Hallo', voiceId: 'Voice123' })
    )._unsafeUnwrapErr();

    expect(first.code).toBe(SPEECH_ERROR_CODES.unavailable);
    expect(String(first.cause)).toContain('TimeoutError');
    expect(String(second.cause)).toContain('unknown error');
  });
});

describe('ElevenLabsSpeechProvider.transcribe', () => {
  it('sends the recording with model and language and returns the trimmed text', async () => {
    const { provider, send } = providerWith(() =>
      Promise.resolve(json({ text: ' Ich habe eine Frage. ', language_code: 'deu' })),
    );

    const result = await provider.transcribe(recording);

    expect(result._unsafeUnwrap()).toEqual({ text: 'Ich habe eine Frage.', languageCode: 'deu' });
    const [url, init] = send.mock.calls[0] ?? [];
    expect(url).toBe('https://api.example.test/v1/speech-to-text');
    expect(init?.headers).toMatchObject({ 'xi-api-key': API_KEY });
    const form = init?.body as FormData;
    expect(form.get('model_id')).toBe('scribe_v1');
    expect(form.get('language_code')).toBe('deu');
    expect(form.get('tag_audio_events')).toBe('false');
    const file = form.get('file') as Blob;
    expect(file.type).toBe('audio/webm');
    expect(file.size).toBe(3);
  });

  it('accepts an answer without a detected language', async () => {
    const { provider } = providerWith(() => Promise.resolve(json({ text: 'Hallo' })));

    expect((await provider.transcribe(recording))._unsafeUnwrap()).toEqual({
      text: 'Hallo',
      languageCode: null,
    });
  });

  it('treats an unknown or unreadable answer as unavailable', async () => {
    const unknownShape = providerWith(() => Promise.resolve(json({ transcript: 'Hallo' })));
    const notJson = providerWith(() => Promise.resolve(new Response('nope', { status: 200 })));

    expect((await unknownShape.provider.transcribe(recording))._unsafeUnwrapErr().code).toBe(
      SPEECH_ERROR_CODES.unavailable,
    );
    expect((await notJson.provider.transcribe(recording))._unsafeUnwrapErr().code).toBe(
      SPEECH_ERROR_CODES.unavailable,
    );
  });

  it('passes a refused call on as a speech error', async () => {
    const { provider } = providerWith(() =>
      Promise.resolve(json({ detail: { status: 'quota_exceeded' } }, 401)),
    );

    const error = (await provider.transcribe(recording))._unsafeUnwrapErr();

    expect(error.code).toBe(SPEECH_ERROR_CODES.quotaExceeded);
    expect(String(error.cause)).toContain('speech-to-text');
  });
});
