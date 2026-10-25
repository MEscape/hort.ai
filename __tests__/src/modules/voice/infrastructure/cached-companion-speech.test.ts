import { afterEach, describe, expect, it, vi } from 'vitest';

import { cachedCompanionSpeech } from '@modules/voice/infrastructure/storage/cached-companion-speech';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { fakeSpeech } from '../fakes';

const request = { voiceId: 'Max', text: 'A small step.' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('private companion speech cache', () => {
  it('reads cached audio without spending provider characters', async () => {
    const speech = fakeSpeech();
    const clips = {
      find: vi.fn(() => okAsync({ url: 'https://private.test/clip', expiresAt: new Date() })),
      save: vi.fn(),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))),
    );
    const result = await cachedCompanionSpeech(speech, clips).synthesize(request);
    expect(result._unsafeUnwrap().audio).toEqual(new Uint8Array([1, 2, 3]));
    expect(speech.synthesize).not.toHaveBeenCalled();
  });
  it('synthesizes once for concurrent misses, saves only synthesized audio, never a recording', async () => {
    const speech = fakeSpeech();
    const clips = {
      find: vi.fn(() => okAsync(null)),
      save: vi.fn(() => okAsync({ url: 'https://private.test/clip', expiresAt: new Date() })),
    };
    const cached = cachedCompanionSpeech(speech, clips);
    const results = await Promise.all([cached.synthesize(request), cached.synthesize(request)]);
    expect(results.every((r) => r.isOk())).toBe(true);
    expect(speech.synthesize).toHaveBeenCalledOnce();
    expect(clips.save).toHaveBeenCalledOnce();
    clips.find.mockClear();
    clips.save.mockClear();
    await cached.transcribe({
      audio: new Uint8Array([8]),
      contentType: 'audio/webm',
      languageCode: 'deu',
    });
    expect(clips.find).not.toHaveBeenCalled();
    expect(clips.save).not.toHaveBeenCalled();
  });
  it('keeps speech working when storage is unavailable', async () => {
    const speech = fakeSpeech();
    const clips = {
      find: vi.fn(() => errAsync(infrastructureError('storage.down', 'Unavailable'))),
      save: vi.fn(() => errAsync(infrastructureError('storage.down', 'Unavailable'))),
    };
    expect((await cachedCompanionSpeech(speech, clips).synthesize(request)).isOk()).toBe(true);
    expect(speech.synthesize).toHaveBeenCalledOnce();
  });
});
