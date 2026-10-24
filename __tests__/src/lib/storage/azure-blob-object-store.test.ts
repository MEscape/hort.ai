import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Clock } from '@lib/clock';
import type { ObjectLocation, UploadRequest } from '@lib/storage';
import { AzureBlobObjectStore } from '@lib/storage/azure-blob-object-store';
import type { AzureBlobObjectStoreOptions } from '@lib/storage/azure-blob-object-store';
import { STORAGE_ERROR_CODES } from '@lib/storage/storage-errors';

import type { Result } from 'neverthrow';

/** Microsoft's published Azurite credentials: public by design. */
const ACCOUNT = 'devstoreaccount1';
const KEY =
  'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';
const ENDPOINT = 'http://127.0.0.1:10000/devstoreaccount1';

const NOW = new Date('2026-10-24T10:00:00Z');
const clock: Clock = { now: () => NOW };

const privateObject: ObjectLocation = { visibility: 'private', key: 'docs/report.pdf' };
const publicObject: ObjectLocation = { visibility: 'public', key: 'avatars/u1.png' };

interface Sent {
  readonly url: URL;
  readonly method: string;
  readonly headers: Record<string, string>;
}

/** A store whose HTTP calls are answered from `responses` in order (the last one repeats). */
function setup(
  responses: Array<Response | Error>,
  overrides: {
    [K in keyof AzureBlobObjectStoreOptions]?: AzureBlobObjectStoreOptions[K] | undefined;
  } = {},
) {
  const sent: Sent[] = [];
  const fakeFetch = vi.fn((input: URL | Request | string, init?: RequestInit) => {
    sent.push({
      url: new URL(input instanceof Request ? input.url : input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    const next = responses[Math.min(sent.length, responses.length) - 1];
    if (next instanceof Error) {
      return Promise.reject(next);
    }
    // The last answer repeats; a body can be read once, so repeats get a copy (clone() tees the body).
    return Promise.resolve(sent.length <= responses.length ? next : next?.clone());
  });
  const store = new AzureBlobObjectStore({
    clock,
    accountName: ACCOUNT,
    accountKey: KEY,
    endpoint: ENDPOINT,
    publicContainer: 'hortai-public',
    privateContainer: 'hortai-private',
    publicBaseUrl: 'http://127.0.0.1:10000/devstoreaccount1/hortai-public/',
    fetch: fakeFetch as unknown as typeof fetch,
    retryDelayMs: 1,
    // A test passes `undefined` on purpose, as a plain-JS caller could.
    ...(overrides as Partial<AzureBlobObjectStoreOptions>),
  });
  return { store, sent, fakeFetch };
}

function unwrap<T>(result: Result<T, unknown>): T {
  if (result.isErr()) {
    throw new Error('expected an ok result');
  }
  return result.value;
}

function unwrapErr<E>(result: Result<unknown, E>): E {
  if (result.isOk()) {
    throw new Error('expected an error result');
  }
  return result.error;
}

const uploadRequest: UploadRequest = {
  location: publicObject,
  contentType: 'image/png',
  byteSize: 1024,
  cacheControl: 'public, max-age=60',
  expiresInSeconds: 300,
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AzureBlobObjectStore: configuration', () => {
  it('supports exactly the visibilities that have a container', () => {
    const { store } = setup([], { privateContainer: undefined });

    expect(store.supports('public')).toBe(true);
    expect(store.supports('private')).toBe(false);
  });

  it('builds public URLs from the public base, without I/O', () => {
    const { store, fakeFetch } = setup([]);

    expect(store.publicUrl('avatars/u1.png')).toBe(
      'http://127.0.0.1:10000/devstoreaccount1/hortai-public/avatars/u1.png',
    );
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('has no public URL for an invalid key or without a public origin', () => {
    expect(setup([]).store.publicUrl('../secret')).toBeNull();
    expect(setup([], { publicBaseUrl: undefined }).store.publicUrl('a.png')).toBeNull();
    expect(setup([], { publicContainer: undefined }).store.publicUrl('a.png')).toBeNull();
  });

  it('addresses https://<account>.blob.core.windows.net and pins the SAS to HTTPS by default', async () => {
    const { store } = setup([], { endpoint: undefined });

    const url = new URL(unwrap(await store.createReadUrl({ key: 'a.pdf', expiresInSeconds: 60 })));

    expect(url.origin).toBe('https://devstoreaccount1.blob.core.windows.net');
    expect(url.pathname).toBe('/hortai-private/a.pdf');
    expect(url.searchParams.get('spr')).toBe('https');
  });

  it('ignores a trailing slash on the endpoint and leaves an HTTP emulator unpinned', async () => {
    const { store } = setup([], { endpoint: `${ENDPOINT}/` });

    const url = new URL(unwrap(await store.createReadUrl({ key: 'a.pdf', expiresInSeconds: 60 })));

    expect(url.pathname).toBe('/devstoreaccount1/hortai-private/a.pdf');
    expect(url.searchParams.has('spr')).toBe(false);
  });
});

describe('AzureBlobObjectStore: signed URLs', () => {
  it('creates an upload target that allows create and write of exactly that blob until it expires', async () => {
    const { store } = setup([]);

    const target = unwrap(await store.createUploadTarget(uploadRequest));
    const url = new URL(target.url);

    expect(target.kind).toBe('http-put');
    expect(url.pathname).toBe('/devstoreaccount1/hortai-public/avatars/u1.png');
    expect(url.searchParams.get('sp')).toBe('cw');
    expect(url.searchParams.get('sr')).toBe('b');
    expect(url.searchParams.get('se')).toBe('2026-10-24T10:05:00Z');
    expect(url.searchParams.get('sig')).toBeTruthy();
    expect(target.expiresAt).toEqual(new Date('2026-10-24T10:05:00Z'));
    expect(target.headers).toEqual({
      'x-ms-blob-type': 'BlockBlob',
      'content-type': 'image/png',
      'x-ms-blob-cache-control': 'public, max-age=60',
    });
  });

  it('refuses an invalid upload request before signing anything', async () => {
    const { store } = setup([]);

    const error = unwrapErr(
      await store.createUploadTarget({
        ...uploadRequest,
        location: { ...publicObject, key: '../x' },
      }),
    );

    expect(error.code).toBe(STORAGE_ERROR_CODES.invalidKey);
  });

  it('refuses an upload to a visibility without a container', async () => {
    const { store } = setup([], { publicContainer: undefined });

    const error = unwrapErr(await store.createUploadTarget(uploadRequest));

    expect(error.code).toBe(STORAGE_ERROR_CODES.visibilityUnavailable);
  });

  it('creates a read URL that only allows reading a private blob', async () => {
    const { store } = setup([]);

    const url = new URL(
      unwrap(await store.createReadUrl({ key: 'docs/report.pdf', expiresInSeconds: 120 })),
    );

    expect(url.pathname).toBe('/devstoreaccount1/hortai-private/docs/report.pdf');
    expect(url.searchParams.get('sp')).toBe('r');
    expect(url.searchParams.get('se')).toBe('2026-10-24T10:02:00Z');
  });

  it('refuses an invalid read request and a missing private container', async () => {
    const { store } = setup([]);
    const withoutPrivate = setup([], { privateContainer: undefined }).store;

    expect(
      unwrapErr(await store.createReadUrl({ key: 'docs/report.pdf', expiresInSeconds: 0 })).code,
    ).toBe(STORAGE_ERROR_CODES.invalidRequest);
    expect(
      unwrapErr(
        await withoutPrivate.createReadUrl({ key: 'docs/report.pdf', expiresInSeconds: 60 }),
      ).code,
    ).toBe(STORAGE_ERROR_CODES.visibilityUnavailable);
  });

  it('reports an unexpected failure without leaking its message', async () => {
    const { store } = setup([], {
      clock: {
        now: () => {
          throw new TypeError('secret sig=abc');
        },
      },
    });

    const error = unwrapErr(await store.createReadUrl({ key: 'a.pdf', expiresInSeconds: 60 }));

    expect(error.code).toBe(STORAGE_ERROR_CODES.rejected);
    expect(String((error as { cause?: unknown }).cause)).not.toContain('secret');
  });
});

describe('AzureBlobObjectStore: head', () => {
  it('describes an existing object, signing a one-minute read', async () => {
    const response = new Response(null, {
      status: 200,
      headers: {
        'content-length': '2048',
        'content-type': 'application/pdf',
        etag: '"0x1"',
        'last-modified': 'Sat, 24 Oct 2026 09:00:00 GMT',
      },
    });
    const { store, sent } = setup([response]);

    const stored = unwrap(await store.head(privateObject));

    expect(stored).toEqual({
      byteSize: 2048,
      contentType: 'application/pdf',
      etag: '"0x1"',
      lastModified: new Date('2026-10-24T09:00:00Z'),
    });
    expect(sent[0]?.method).toBe('HEAD');
    expect(sent[0]?.url.searchParams.get('sp')).toBe('r');
    expect(sent[0]?.url.searchParams.get('se')).toBe('2026-10-24T10:01:00Z');
  });

  it('falls back to a zero size and no date when the headers are missing', async () => {
    const { store } = setup([new Response(null, { status: 200 })]);

    const stored = unwrap(await store.head(privateObject));

    expect(stored).toMatchObject({ byteSize: 0, lastModified: null, etag: null });
  });

  it('answers null for an object that does not exist', async () => {
    const { store } = setup([new Response(null, { status: 404 })]);

    expect(unwrap(await store.head(privateObject))).toBeNull();
  });

  it('rejects, without retrying, what retrying cannot fix', async () => {
    const body = '<?xml version="1.0"?><Error><Code>AuthenticationFailed</Code></Error>';
    const { store, fakeFetch } = setup([new Response(body, { status: 403 })]);

    const error = unwrapErr(await store.head(privateObject));

    expect(error.code).toBe(STORAGE_ERROR_CODES.rejected);
    expect(String((error as { cause?: unknown }).cause)).toContain('AuthenticationFailed');
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('retries a transient failure and then succeeds', async () => {
    const { store, fakeFetch } = setup([
      new Response('<Error><Code>ServerBusy</Code></Error>', { status: 503 }),
      new Response(null, { status: 429 }),
      new Response(null, { status: 200, headers: { 'content-length': '5' } }),
    ]);

    expect(unwrap(await store.head(privateObject))).toMatchObject({ byteSize: 5 });
    expect(fakeFetch).toHaveBeenCalledTimes(3);
  });

  it('gives up with an unavailable error once the attempts are used', async () => {
    const { store, fakeFetch } = setup([new Response(null, { status: 500 })], { attempts: 2 });

    const error = unwrapErr(await store.head(privateObject));

    expect(error.code).toBe(STORAGE_ERROR_CODES.unavailable);
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });

  it('treats a request that never completed as unavailable, naming only the error type', async () => {
    const { store } = setup([new TypeError('connect ECONNREFUSED ?sig=abc'), new TypeError('x')], {
      attempts: 2,
    });

    const error = unwrapErr(await store.head(privateObject));

    expect(error.code).toBe(STORAGE_ERROR_CODES.unavailable);
    expect(String((error as { cause?: unknown }).cause)).toContain('TypeError');
    expect(String((error as { cause?: unknown }).cause)).not.toContain('sig=');
  });

  it('reports an unusable error without a thrown Error as an unknown error', async () => {
    const { store } = setup([new Error('x')], {
      attempts: 1,
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the case under test is a rejection that is not an Error
      fetch: () => Promise.reject('boom'),
    });

    const error = unwrapErr(await store.head(privateObject));

    expect(String((error as { cause?: unknown }).cause)).toContain('unknown error');
  });

  it('refuses an invalid key without calling the service', async () => {
    const { store, fakeFetch } = setup([]);

    const error = unwrapErr(await store.head({ visibility: 'private', key: 'a//b' }));

    expect(error.code).toBe(STORAGE_ERROR_CODES.invalidKey);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('uses the global fetch and the default timing when none is injected', async () => {
    vi.useFakeTimers();
    const globalFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', globalFetch);
    const { store } = setup([], { fetch: undefined, retryDelayMs: undefined });

    const pending = store.head(privateObject);
    await vi.advanceTimersByTimeAsync(200);

    expect(unwrap(await pending)).toMatchObject({ byteSize: 0 });
    expect(globalFetch).toHaveBeenCalledTimes(2);
  });
});

describe('AzureBlobObjectStore: readStart', () => {
  it('asks for only the first bytes and returns what arrived', async () => {
    const { store, sent } = setup([new Response(new Uint8Array([1, 2, 3, 4]), { status: 206 })]);

    const bytes = unwrap(await store.readStart(privateObject, 4));

    expect([...bytes]).toEqual([1, 2, 3, 4]);
    expect(sent[0]?.method).toBe('GET');
    expect(sent[0]?.headers).toEqual({ range: 'bytes=0-3' });
  });

  it('never returns more than asked for, even when the service ignores the range', async () => {
    const { store } = setup([new Response(new Uint8Array([9, 8, 7, 6, 5, 4]), { status: 200 })]);

    expect([...unwrap(await store.readStart(privateObject, 4))]).toEqual([9, 8, 7, 6]);
  });

  it('returns nothing for a response without a body', async () => {
    const { store } = setup([new Response(null, { status: 200 })]);

    expect(unwrap(await store.readStart(privateObject, 4)).byteLength).toBe(0);
  });

  it('returns nothing for an empty blob, which no range can satisfy', async () => {
    const { store } = setup([
      new Response('<Error><Code>InvalidRange</Code></Error>', { status: 416 }),
    ]);

    expect(unwrap(await store.readStart(privateObject, 4)).byteLength).toBe(0);
  });

  it('fails with not_found for a missing object', async () => {
    const { store } = setup([new Response(null, { status: 404 })]);

    expect(unwrapErr(await store.readStart(privateObject, 4)).code).toBe(
      STORAGE_ERROR_CODES.objectNotFound,
    );
  });

  it('rejects a byte count outside the allowed range', async () => {
    const { store, fakeFetch } = setup([]);

    expect(unwrapErr(await store.readStart(privateObject, 0)).code).toBe(
      STORAGE_ERROR_CODES.invalidRequest,
    );
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('fails when the service refuses, and when the transfer breaks off', async () => {
    const forbidden = setup([new Response(null, { status: 403 })]).store;
    const cutOff = new Response(
      new ReadableStream({
        pull(controller) {
          controller.error(new Error('reset'));
        },
      }),
      { status: 206 },
    );
    const broken = setup([cutOff], { attempts: 1 }).store;

    expect(unwrapErr(await forbidden.readStart(privateObject, 4)).code).toBe(
      STORAGE_ERROR_CODES.rejected,
    );
    expect(unwrapErr(await broken.readStart(privateObject, 4)).code).toBe(
      STORAGE_ERROR_CODES.unavailable,
    );
  });

  it('refuses an invalid key and a transport failure', async () => {
    const { store } = setup([new TypeError('down')], { attempts: 1 });

    expect(unwrapErr(await store.readStart({ visibility: 'private', key: '..' }, 4)).code).toBe(
      STORAGE_ERROR_CODES.invalidKey,
    );
    expect(unwrapErr(await store.readStart(privateObject, 4)).code).toBe(
      STORAGE_ERROR_CODES.unavailable,
    );
  });

  it('still reports the status when the error body cannot be read', async () => {
    const unreadable = new Response(
      new ReadableStream({
        pull(controller) {
          controller.error(new Error('reset'));
        },
      }),
      { status: 403 },
    );
    const { store } = setup([unreadable]);

    const error = unwrapErr(await store.readStart(privateObject, 4));

    expect(String((error as { cause?: unknown }).cause)).toContain('status 403');
  });
});

describe('AzureBlobObjectStore: delete', () => {
  it('deletes with a delete-only SAS, snapshots included', async () => {
    const { store, sent } = setup([new Response(null, { status: 202 })]);

    unwrap(await store.delete(publicObject));

    expect(sent[0]?.method).toBe('DELETE');
    expect(sent[0]?.url.searchParams.get('sp')).toBe('d');
    expect(sent[0]?.headers).toEqual({ 'x-ms-delete-snapshots': 'include' });
  });

  it('succeeds when the object is already gone', async () => {
    const { store } = setup([new Response(null, { status: 404 })]);

    expect((await store.delete(publicObject)).isOk()).toBe(true);
  });

  it('fails when the service refuses, or cannot be reached', async () => {
    const refused = setup([new Response(null, { status: 403 })]).store;
    const down = setup([new TypeError('down')], { attempts: 1 }).store;
    const invalid = setup([]).store;

    expect(unwrapErr(await refused.delete(publicObject)).code).toBe(STORAGE_ERROR_CODES.rejected);
    expect(unwrapErr(await down.delete(publicObject)).code).toBe(STORAGE_ERROR_CODES.unavailable);
    expect(unwrapErr(await invalid.delete({ visibility: 'public', key: '' })).code).toBe(
      STORAGE_ERROR_CODES.invalidKey,
    );
  });
});
