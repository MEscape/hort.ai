import { storageRejected, storageUnavailable } from './storage-errors';

import type { StoredObject } from './object-store';
import type { StorageError } from './storage-errors';

/** Status codes that mean "try again later" rather than "this will never work". */
const REQUEST_TIMEOUT = 408;
const TOO_EARLY = 425;
const TOO_MANY_REQUESTS = 429;
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([
  REQUEST_TIMEOUT,
  TOO_EARLY,
  TOO_MANY_REQUESTS,
]);
const SERVER_ERROR_FROM = 500;
/** Enough of an Azure error body to read its `<Code>`, never enough to buffer anything large. */
const ERROR_BODY_PEEK_BYTES = 2048;

export const NOT_FOUND = 404;
export const RANGE_NOT_SATISFIABLE = 416;

/**
 * Reading what the Blob service answers, the one place its response shapes are known. They leave
 * this file only as `StoredObject`, bytes or `StorageError`.
 */

/** The name of a thrown value, which is all that may reach an error: its message can hold a signed URL. */
export function errorName(thrown: unknown): string {
  return thrown instanceof Error ? thrown.name : 'unknown error';
}

/**
 * A request that never completed: timeout, reset, DNS failure, or a body cut off mid-read. It may
 * well succeed later, so it is retryable.
 */
export function transportFailure(operation: string, thrown: unknown): StorageError {
  return storageUnavailable(
    new Error(`Azure Blob ${operation} could not be completed: ${errorName(thrown)}`),
  );
}

export function describeObject(response: Response): StoredObject {
  const size = Number(response.headers.get('content-length') ?? Number.NaN);
  const modified = new Date(response.headers.get('last-modified') ?? Number.NaN);
  return {
    byteSize: Number.isInteger(size) && size >= 0 ? size : 0,
    contentType: response.headers.get('content-type'),
    etag: response.headers.get('etag'),
    lastModified: Number.isNaN(modified.getTime()) ? null : modified,
  };
}

/** A transient status is worth a retry; anything else (credentials, policy, bad container) is not. */
export async function azureFailure(operation: string, response: Response): Promise<StorageError> {
  const code = await azureErrorCode(response);
  const cause = new Error(
    `Azure Blob ${operation} failed with status ${response.status}${code ? ` (${code})` : ''}`,
  );
  const transient = response.status >= SERVER_ERROR_FROM || RETRYABLE_STATUSES.has(response.status);
  return transient ? storageUnavailable(cause) : storageRejected(cause);
}

/** The `<Code>` of an Azure XML error (e.g. `AuthenticationFailed`), which says why without exposing anything. */
async function azureErrorCode(response: Response): Promise<string | null> {
  try {
    const bytes = await readAtMost(response, ERROR_BODY_PEEK_BYTES);
    return /<Code>([A-Za-z0-9]+)<\/Code>/.exec(new TextDecoder().decode(bytes))?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Reads at most `limit` bytes and stops: a server that ignores `Range` must not make us buffer a file. */
export async function readAtMost(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.body) {
    return new Uint8Array();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (received < limit) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      received += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const out = new Uint8Array(Math.min(received, limit));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.byteLength, out.byteLength - offset);
    out.set(chunk.subarray(0, take), offset);
    offset += take;
  }
  return out;
}
