import { infrastructureError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { ObjectStore } from '@lib/storage';

import { MATERIAL_URL_SECONDS } from '../../domain/models/material';

import type { MaterialObjectWriter } from '../../domain/ports/material-services.port';

/** Up to 10 MiB to the storage account; the teacher waits for the completion. */
const WRITE_TIMEOUT_MS = 30_000;
const writeFailed = () =>
  infrastructureError('teacher_material.write_failed', 'Material could not be stored.');

/**
 * Server-side write through the same signed one-object PUT a browser would use (as the voice
 * clips do), so the store needs no write operation of its own. The signed URL is created, used
 * once and dropped here; it never reaches the client or diagnostics.
 */
export class SignedMaterialObjectWriter implements MaterialObjectWriter {
  constructor(
    private readonly store: ObjectStore,
    private readonly request: typeof fetch = fetch,
  ) {}
  write: MaterialObjectWriter['write'] = (location, bytes, contentType) =>
    this.store
      .createUploadTarget({
        location,
        contentType,
        byteSize: bytes.byteLength,
        cacheControl: 'no-store',
        expiresInSeconds: MATERIAL_URL_SECONDS,
      })
      .andThen((target) =>
        fromThrowableAsync(
          () =>
            this.request(target.url, {
              method: 'PUT',
              headers: target.headers,
              body: new Uint8Array(bytes),
              redirect: 'error',
              signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
            }),
          writeFailed,
        ),
      )
      .andThen((response) => (response.ok ? okAsync(undefined) : errAsync(writeFailed())));
}
