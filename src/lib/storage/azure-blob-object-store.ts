import type { Clock } from '@lib/clock';
import { err, ok, ResultAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';
import { sleep, stripTrailingSlash } from '@lib/utils';

import {
  NOT_FOUND,
  RANGE_NOT_SATISFIABLE,
  azureFailure,
  describeObject,
  errorName,
  readAtMost,
  transportFailure,
} from './azure-blob-responses';
import { blobSasQuery } from './azure-blob-sas';
import {
  validateObjectKey,
  validateReadStartBytes,
  validateReadUrlRequest,
  validateUploadRequest,
} from './request-validation';
import {
  isRetryableStorageError,
  storageObjectNotFound,
  storageRejected,
  storageVisibilityUnavailable,
} from './storage-errors';

import type { BlobSasPermissions } from './azure-blob-sas';
import type {
  ObjectLocation,
  ObjectStore,
  ObjectVisibility,
  ReadUrlRequest,
  StoredObject,
  UploadRequest,
  UploadTarget,
} from './object-store';
import type { StorageError } from './storage-errors';

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 200;
const MS_PER_SECOND = 1000;
/** The server's own calls sign for a minute: long enough for one request, too short to be worth stealing. */
const SERVER_CALL_TTL_SECONDS = 60;

export interface AzureBlobObjectStoreOptions {
  readonly clock: Clock;
  readonly accountName: string;
  /** The account key, base64. Signs every URL; appears in no error, log line or `cause`. */
  readonly accountKey: string;
  /** Blob service URL without a container. Leave out for `https://<account>.blob.core.windows.net`. */
  readonly endpoint?: string;
  readonly publicContainer?: string;
  readonly privateContainer?: string;
  /** Where the public container is served from; the origin, not the Blob API. */
  readonly publicBaseUrl?: string;
  /** Replaceable for tests. */
  readonly fetch?: typeof fetch;
  readonly requestTimeoutMs?: number;
  readonly attempts?: number;
  readonly retryDelayMs?: number;
}

type Outcome<T> = AppResult<T, StorageError>;

/**
 * `ObjectStore` over the Azure Blob REST API, spoken directly with service SAS signing from
 * `node:crypto` instead of a vendor SDK: no dependency and no transitive tree for four requests
 * and two signed URLs. The server's own calls (head, read, delete) carry a one-minute SAS of a
 * single permission, so there is one signing path for them and for the URLs handed to clients.
 *
 * A SAS cannot pin the size or content type of an upload the way a signed header can elsewhere, so the
 * `byteSize` of an upload request is not enforced here: callers verify what arrived with `head`
 * (and `readStart` for the file signature) before they trust it.
 *
 * Credentials are explicit and never taken from the environment's ambient credential chain.
 * Signed URLs and the account key appear in no error, log line or `cause`.
 */
export class AzureBlobObjectStore implements ObjectStore {
  private readonly send: typeof fetch;
  private readonly endpoint: string;
  private readonly containers: Readonly<Record<ObjectVisibility, string | undefined>>;
  private readonly publicBase: string | null;

  constructor(private readonly options: AzureBlobObjectStoreOptions) {
    this.send = options.fetch ?? fetch;
    this.endpoint = stripTrailingSlash(
      options.endpoint ?? `https://${options.accountName}.blob.core.windows.net`,
    );
    this.containers = { public: options.publicContainer, private: options.privateContainer };
    this.publicBase =
      options.publicContainer && options.publicBaseUrl
        ? stripTrailingSlash(options.publicBaseUrl)
        : null;
  }

  supports(visibility: ObjectVisibility): boolean {
    return this.containers[visibility] !== undefined;
  }

  publicUrl(key: string): string | null {
    if (this.publicBase === null || validateObjectKey(key).isErr()) {
      return null;
    }
    return `${this.publicBase}/${key}`;
  }

  createUploadTarget(request: UploadRequest): AppResultAsync<UploadTarget, StorageError> {
    return this.settle(() => {
      const valid = validateUploadRequest(request);
      if (valid.isErr()) {
        return err(valid.error);
      }
      const url = this.signedUrl(request.location, 'cw', request.expiresInSeconds);
      if (url.isErr()) {
        return err(url.error);
      }
      return ok<UploadTarget>({
        kind: 'http-put',
        url: url.value.toString(),
        headers: {
          // Put Blob refuses a request without a blob type; a block blob is the ordinary file.
          'x-ms-blob-type': 'BlockBlob',
          'content-type': request.contentType,
          'x-ms-blob-cache-control': request.cacheControl,
        },
        expiresAt: new Date(
          this.options.clock.now().getTime() + request.expiresInSeconds * MS_PER_SECOND,
        ),
      });
    });
  }

  head(location: ObjectLocation): AppResultAsync<StoredObject | null, StorageError> {
    return this.settle(() =>
      this.withRetry(async () => {
        const response = await this.call({ method: 'HEAD', location, permissions: 'r' });
        if (response.isErr()) {
          return err(response.error);
        }
        if (response.value.status === NOT_FOUND) {
          return ok(null);
        }
        if (!response.value.ok) {
          return err(await azureFailure('HEAD', response.value));
        }
        return ok(describeObject(response.value));
      }),
    );
  }

  readStart(location: ObjectLocation, byteCount: number): AppResultAsync<Uint8Array, StorageError> {
    return this.settle(() =>
      this.withRetry(async () => {
        const count = validateReadStartBytes(byteCount);
        if (count.isErr()) {
          return err(count.error);
        }
        const response = await this.call({
          method: 'GET',
          location,
          permissions: 'r',
          headers: { range: `bytes=0-${byteCount - 1}` },
        });
        if (response.isErr()) {
          return err(response.error);
        }
        if (response.value.status === NOT_FOUND) {
          return err(storageObjectNotFound());
        }
        // An empty blob cannot satisfy any range.
        if (response.value.status === RANGE_NOT_SATISFIABLE) {
          return ok(new Uint8Array());
        }
        if (!response.value.ok) {
          return err(await azureFailure('GET', response.value));
        }
        try {
          return ok(await readAtMost(response.value, byteCount));
        } catch (cause) {
          // The body can be cut off after the headers arrived.
          return err(transportFailure('GET', cause));
        }
      }),
    );
  }

  delete(location: ObjectLocation): AppResultAsync<void, StorageError> {
    return this.settle(() =>
      this.withRetry(async () => {
        const response = await this.call({
          method: 'DELETE',
          location,
          permissions: 'd',
          headers: { 'x-ms-delete-snapshots': 'include' },
        });
        if (response.isErr()) {
          return err(response.error);
        }
        // Deleting what is already gone is a success.
        if (response.value.ok || response.value.status === NOT_FOUND) {
          return ok(undefined);
        }
        return err(await azureFailure('DELETE', response.value));
      }),
    );
  }

  createReadUrl(request: ReadUrlRequest): AppResultAsync<string, StorageError> {
    return this.settle(() => {
      const valid = validateReadUrlRequest(request);
      if (valid.isErr()) {
        return err(valid.error);
      }
      return this.signedUrl(
        { visibility: 'private', key: request.key },
        'r',
        request.expiresInSeconds,
      ).map((signed) => signed.toString());
    });
  }

  // ------------------------------------------------------------------------------------------

  private settle<T>(run: () => Outcome<T> | Promise<Outcome<T>>): AppResultAsync<T, StorageError> {
    return new ResultAsync(
      // Nothing in `run` is expected to throw; if it does, say so without the cause's message.
      Promise.resolve()
        .then(run)
        .catch((cause: unknown) =>
          err(
            storageRejected(
              new Error(`Azure Blob request failed unexpectedly: ${errorName(cause)}`),
            ),
          ),
        ),
    );
  }

  /** Repeats an idempotent request, with doubling pauses, while the provider reports a transient failure. */
  private async withRetry<T>(attempt: () => Promise<Outcome<T>>): Promise<Outcome<T>> {
    const attempts = this.options.attempts ?? DEFAULT_ATTEMPTS;
    const baseDelayMs = this.options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

    let outcome = await attempt();
    for (
      let tried = 1;
      tried < attempts && outcome.isErr() && isRetryableStorageError(outcome.error);
      tried++
    ) {
      await sleep(baseDelayMs * 2 ** (tried - 1));
      outcome = await attempt();
    }
    return outcome;
  }

  /** The blob's URL with a SAS of one permission, valid for `ttlSeconds` from now. */
  private signedUrl(
    location: ObjectLocation,
    permissions: BlobSasPermissions,
    ttlSeconds: number,
  ): Outcome<URL> {
    const key = validateObjectKey(location.key);
    if (key.isErr()) {
      return err(key.error);
    }
    const container = this.containers[location.visibility];
    if (container === undefined) {
      return err(storageVisibilityUnavailable(location.visibility));
    }

    const url = new URL(`${this.endpoint}/${container}/${location.key}`);
    const sas = blobSasQuery({
      accountName: this.options.accountName,
      accountKey: this.options.accountKey,
      container,
      key: location.key,
      permissions,
      expiresAt: new Date(this.options.clock.now().getTime() + ttlSeconds * MS_PER_SECOND),
      httpsOnly: url.protocol === 'https:',
    });
    url.search = sas.toString();
    return ok(url);
  }

  private async call({
    method,
    location,
    permissions,
    headers = {},
  }: {
    readonly method: string;
    readonly location: ObjectLocation;
    readonly permissions: BlobSasPermissions;
    readonly headers?: Record<string, string>;
  }): Promise<Outcome<Response>> {
    const url = this.signedUrl(location, permissions, SERVER_CALL_TTL_SECONDS);
    if (url.isErr()) {
      return err(url.error);
    }
    try {
      return ok(
        await this.send(url.value, {
          method,
          headers,
          signal: AbortSignal.timeout(this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS),
        }),
      );
    } catch (cause) {
      return err(transportFailure(method, cause));
    }
  }
}
