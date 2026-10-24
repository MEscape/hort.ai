// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';

import { systemClock } from '@lib/clock';
import type { ObjectLocation } from '@lib/storage';
import { AzureBlobObjectStore } from '@lib/storage/azure-blob-object-store';
import { STORAGE_ERROR_CODES } from '@lib/storage/storage-errors';

/**
 * The adapter against a real Blob service: Azurite from `docker compose up azurite azurite-init`
 * (CI starts the same services). It reads the application's own `STORAGE_AZURE_*` settings
 * (`.env` locally, the job environment in CI) and is skipped unless `STORAGE_PROVIDER=azure`.
 * The emulator's account is Microsoft's published one.
 */
const settings = process.env;
const isEnabled = settings['STORAGE_PROVIDER'] === 'azure';
const endpoint = settings['STORAGE_AZURE_BLOB_ENDPOINT'];
const ACCOUNT = settings['STORAGE_AZURE_ACCOUNT_NAME'] ?? '';
const KEY = settings['STORAGE_AZURE_ACCOUNT_KEY'] ?? '';
const PUBLIC_CONTAINER = settings['STORAGE_AZURE_PUBLIC_CONTAINER'];
const PRIVATE_CONTAINER = settings['STORAGE_AZURE_PRIVATE_CONTAINER'];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function createStore(accountKey = KEY) {
  return new AzureBlobObjectStore({
    clock: systemClock,
    accountName: ACCOUNT,
    accountKey,
    ...(endpoint ? { endpoint } : {}),
    ...(PUBLIC_CONTAINER ? { publicContainer: PUBLIC_CONTAINER } : {}),
    ...(PRIVATE_CONTAINER ? { privateContainer: PRIVATE_CONTAINER } : {}),
    publicBaseUrl: settings['STORAGE_PUBLIC_BASE_URL'] ?? `${endpoint}/${PUBLIC_CONTAINER}`,
    attempts: 1,
  });
}

function unwrap<T>(result: { isOk(): boolean; value?: T }): T {
  if (!result.isOk()) {
    throw new Error(`expected an ok result, got ${JSON.stringify(result)}`);
  }
  return result.value as T;
}

describe.skipIf(!isEnabled || !endpoint)('AzureBlobObjectStore against Azurite', () => {
  const store = createStore();
  let runId = '';

  beforeAll(() => {
    // Each run owns its keys, so reruns against a long-lived emulator never collide.
    runId = `it-${Date.now().toString(36)}`;
  });

  async function upload(
    location: ObjectLocation,
    bytes: Uint8Array<ArrayBuffer>,
    contentType: string,
  ) {
    const target = unwrap(
      await store.createUploadTarget({
        location,
        contentType,
        byteSize: bytes.byteLength,
        cacheControl: 'public, max-age=60',
        expiresInSeconds: 60,
      }),
    );
    return fetch(target.url, { method: 'PUT', headers: target.headers, body: bytes });
  }

  it.each(['public', 'private'] as const)(
    'stores, inspects, reads the start of and deletes a %s object',
    async (visibility) => {
      const location: ObjectLocation = { visibility, key: `${runId}/image.png` };
      const bytes = new Uint8Array([...PNG_SIGNATURE, 1, 2, 3, 4]);

      expect((await upload(location, bytes, 'image/png')).status).toBe(201);

      const stored = unwrap(await store.head(location));
      expect(stored).toMatchObject({ byteSize: bytes.byteLength, contentType: 'image/png' });
      expect(stored?.lastModified).toBeInstanceOf(Date);
      expect([...unwrap(await store.readStart(location, PNG_SIGNATURE.length))]).toEqual(
        PNG_SIGNATURE,
      );

      unwrap(await store.delete(location));
      expect(unwrap(await store.head(location))).toBeNull();
      unwrap(await store.delete(location));
    },
  );

  it('serves a public object anonymously, with the cache-control it was uploaded with', async () => {
    const location: ObjectLocation = { visibility: 'public', key: `${runId}/public.png` };
    await upload(location, new Uint8Array(PNG_SIGNATURE), 'image/png');

    const response = await fetch(store.publicUrl(location.key) ?? '');

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=60');
    unwrap(await store.delete(location));
  });

  it('serves a private object only through a signed URL', async () => {
    const location: ObjectLocation = { visibility: 'private', key: `${runId}/private.pdf` };
    await upload(location, new Uint8Array([37, 80, 68, 70]), 'application/pdf');

    const signed = unwrap(await store.createReadUrl({ key: location.key, expiresInSeconds: 60 }));
    const withoutSignature = signed.split('?')[0] ?? '';

    expect((await fetch(signed)).status).toBe(200);
    expect((await fetch(withoutSignature)).status).toBe(403);
    unwrap(await store.delete(location));
  });

  it('refuses an upload signed for another blob, or with a wrong key', async () => {
    const location: ObjectLocation = { visibility: 'private', key: `${runId}/signed.bin` };
    const target = unwrap(
      await store.createUploadTarget({
        location,
        contentType: 'application/octet-stream',
        byteSize: 1,
        cacheControl: 'no-store',
        expiresInSeconds: 60,
      }),
    );
    const otherBlob = target.url.replace('signed.bin', 'other.bin');

    const response = await fetch(otherBlob, { method: 'PUT', headers: target.headers, body: 'x' });
    const wrongKey = await createStore(Buffer.from('not the real key').toString('base64')).head(
      location,
    );

    expect(response.status).toBe(403);
    expect(wrongKey.isErr() && wrongKey.error.code).toBe(STORAGE_ERROR_CODES.rejected);
  });

  it('fails with not_found when reading the start of a missing object', async () => {
    const result = await store.readStart({ visibility: 'private', key: `${runId}/missing.bin` }, 8);

    expect(result.isErr() && result.error.code).toBe(STORAGE_ERROR_CODES.objectNotFound);
  });

  it('reads an empty object as no bytes', async () => {
    const location: ObjectLocation = { visibility: 'private', key: `${runId}/empty.bin` };
    // The upload contract refuses a size of 0, so write the empty blob with a stated size of 1.
    const target = unwrap(
      await store.createUploadTarget({
        location,
        contentType: 'application/octet-stream',
        byteSize: 1,
        cacheControl: 'no-store',
        expiresInSeconds: 60,
      }),
    );
    await fetch(target.url, { method: 'PUT', headers: target.headers, body: new Uint8Array() });

    expect(unwrap(await store.readStart(location, 8)).byteLength).toBe(0);
    unwrap(await store.delete(location));
  });
});
