import { infrastructureError } from '@lib/errors';
import { err, ok, fromThrowableAsync } from '@lib/result';
import type { ObjectStore } from '@lib/storage';

import { MATERIAL_URL_SECONDS } from '../../domain/models/material';

import type { MaterialTextReader } from '../../domain/ports/material-services.port';

const READ_TIMEOUT_MS = 15_000;
const readFailed = () =>
  infrastructureError('teacher_material.read_failed', 'Material could not be read.');

/** Signed GET with a streaming cap and timeout; URLs and response bodies never enter diagnostics. */
export class SignedMaterialTextReader implements MaterialTextReader {
  constructor(
    private readonly store: ObjectStore,
    private readonly request: typeof fetch = fetch,
  ) {}
  read: MaterialTextReader['read'] = (location, maxBytes) =>
    this.store
      .createReadUrl({ key: location.key, expiresInSeconds: MATERIAL_URL_SECONDS })
      .andThen((url) =>
        fromThrowableAsync(async () => {
          const response = await this.request(url, {
            cache: 'no-store',
            redirect: 'error',
            signal: AbortSignal.timeout(READ_TIMEOUT_MS),
          });
          if (!response.ok || !response.body) {return err(readFailed());}
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          let done = false;
          try {
            while (!done) {
              const part = await reader.read();
              done = part.done;
              if (part.done) {continue;}
              size += part.value.length;
              if (size > maxBytes) {return err(readFailed());}
              chunks.push(part.value);
            }
          } finally {
            await reader.cancel();
          }
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
          }
          return ok(bytes);
        }, readFailed).andThen((result) => result),
      );
}
