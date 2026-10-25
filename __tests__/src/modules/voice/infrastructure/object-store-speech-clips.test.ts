import { describe, expect, it, vi } from 'vitest';

import { objectStoreSpeechClips } from '@modules/voice/infrastructure/storage/object-store-speech-clips';

import { okAsync } from '@lib/result';
import type { ObjectLocation, ObjectStore, StoredObject, UploadRequest } from '@lib/storage';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const clock = { now: () => NOW };
const CONTENT = { voice: 'VoiceMax', text: 'Lennart wann holen wir uns draußen Suppe' };
const AUDIO = new Uint8Array([0xff, 0xfb, 0x90]);

function fakeStore(existing: StoredObject | null = null) {
  const store = {
    supports: () => true,
    publicUrl: () => null,
    head: vi.fn((_location: ObjectLocation) => okAsync(existing)),
    readStart: vi.fn(),
    delete: vi.fn(),
    createUploadTarget: vi.fn((request: UploadRequest) =>
      okAsync({
        kind: 'http-put' as const,
        url: `https://store.example/${request.location.key}?sig=w`,
        headers: { 'x-ms-blob-type': 'BlockBlob', 'content-type': request.contentType },
        expiresAt: NOW,
      }),
    ),
    createReadUrl: vi.fn((request: { key: string; expiresInSeconds: number }) =>
      okAsync(`https://store.example/${request.key}?sig=r`),
    ),
  };
  return store satisfies ObjectStore;
}

function ok(status = 201) {
  return vi.fn((_url: string, _init: RequestInit) =>
    Promise.resolve(new Response(null, { status })),
  );
}

describe('objectStoreSpeechClips', () => {
  it('keys a clip by a hash of voice and text, in the private container', async () => {
    const store = fakeStore();
    const clips = objectStoreSpeechClips(store, { clock, fetch: ok() });

    await clips.find(CONTENT);
    await clips.find({ ...CONTENT, voice: 'VoiceLili' });

    const [first, second] = store.head.mock.calls.map(([location]) => location);
    expect(first?.visibility).toBe('private');
    expect(first?.key).toMatch(/^speech-clips\/[0-9a-f]{64}\.mp3$/);
    expect(first?.key).not.toContain('Suppe');
    expect(second?.key).not.toBe(first?.key);
  });

  it('finds nothing for a missing or empty object and a read URL for a stored one', async () => {
    const missing = objectStoreSpeechClips(fakeStore(null), { clock, fetch: ok() });
    const empty = objectStoreSpeechClips(
      fakeStore({ byteSize: 0, contentType: null, etag: null, lastModified: null }),
      { clock, fetch: ok() },
    );
    const store = fakeStore({
      byteSize: 3,
      contentType: 'audio/mpeg',
      etag: null,
      lastModified: null,
    });
    const present = objectStoreSpeechClips(store, { clock, fetch: ok() });

    expect((await missing.find(CONTENT))._unsafeUnwrap()).toBeNull();
    expect((await empty.find(CONTENT))._unsafeUnwrap()).toBeNull();
    const found = (await present.find(CONTENT))._unsafeUnwrap();
    expect(found?.url).toMatch(
      /^https:\/\/store\.example\/speech-clips\/[0-9a-f]{64}\.mp3\?sig=r$/,
    );
    expect(found?.expiresAt).toEqual(new Date('2026-10-25T12:15:00.000Z'));
    expect(store.createReadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInSeconds: 900 }),
    );
  });

  it('reads the audio of a stored clip through its read URL, and nothing for a missing one', async () => {
    const stored = fakeStore({
      byteSize: 3,
      contentType: 'audio/mpeg',
      etag: null,
      lastModified: null,
    });
    const send = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(new Response(AUDIO, { status: 200 })),
    );
    const present = objectStoreSpeechClips(stored, { clock, fetch: send });
    const missing = objectStoreSpeechClips(fakeStore(null), { clock, fetch: send });
    const refused = objectStoreSpeechClips(stored, { clock, fetch: ok(403) });

    expect((await present.findAudio(CONTENT))._unsafeUnwrap()).toEqual({
      audio: AUDIO,
      contentType: 'audio/mpeg',
    });
    const [url, init] = send.mock.calls[0] ?? [];
    expect(url).toContain('?sig=r');
    expect(init).toMatchObject({ method: 'GET' });
    expect((await missing.findAudio(CONTENT))._unsafeUnwrap()).toBeNull();
    expect(send).toHaveBeenCalledOnce();
    expect((await refused.findAudio(CONTENT))._unsafeUnwrapErr().code).toBe('voice.clip_failed');
  });

  it('uploads through the signed target with its exact headers, then signs a read URL', async () => {
    const store = fakeStore();
    const send = ok();
    const clips = objectStoreSpeechClips(store, { clock, fetch: send });

    const saved = await clips.save(CONTENT, AUDIO, 'audio/mpeg');

    expect(saved._unsafeUnwrap().url).toContain('?sig=r');
    expect(store.createUploadTarget).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'audio/mpeg', byteSize: 3 }),
    );
    const [url, init] = send.mock.calls[0] ?? [];
    expect(url).toContain('?sig=w');
    expect(init).toMatchObject({
      method: 'PUT',
      headers: { 'x-ms-blob-type': 'BlockBlob', 'content-type': 'audio/mpeg' },
      body: AUDIO,
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('fails with voice.clip_failed when the upload is refused or the network fails', async () => {
    const refused = objectStoreSpeechClips(fakeStore(), { clock, fetch: ok(403) });
    const offline = objectStoreSpeechClips(fakeStore(), {
      clock,
      fetch: () => Promise.reject(new Error('offline')),
    });

    expect((await refused.save(CONTENT, AUDIO, 'audio/mpeg'))._unsafeUnwrapErr().code).toBe(
      'voice.clip_failed',
    );
    expect((await offline.save(CONTENT, AUDIO, 'audio/mpeg'))._unsafeUnwrapErr().code).toBe(
      'voice.clip_failed',
    );
  });
});
