import type { AppResultAsync } from '@lib/result';

import type { StorageError } from './storage-errors';

/**
 * `public` objects are delivered to anyone from the public origin and never need a signature.
 * `private` objects are only reachable through a short-lived signed read URL. Each visibility is
 * its own container: a public origin serves a whole container, so a private object can never live in it.
 */
export const OBJECT_VISIBILITIES = ['public', 'private'] as const;
export type ObjectVisibility = (typeof OBJECT_VISIBILITIES)[number];

/** Where an object lives. Keys are only unique within one visibility. */
export interface ObjectLocation {
  readonly visibility: ObjectVisibility;
  /**
   * Chosen by the caller from trusted data, never from a user-supplied filename. Implementations
   * reject anything but `[A-Za-z0-9._-]` segments joined by `/` (no traversal, no empty segment).
   */
  readonly key: string;
}

export interface UploadRequest {
  readonly location: ObjectLocation;
  /** A bare `type/subtype` (no parameters). The upload must send exactly this as its content type. */
  readonly contentType: string;
  /**
   * The exact size the upload is meant to have. A signed URL cannot always enforce it (Azure's
   * cannot), so callers confirm the stored size with `head` before they trust the object.
   */
  readonly byteSize: number;
  readonly cacheControl: string;
  readonly expiresInSeconds: number;
}

/**
 * One permission to write one object, once the client sends the stated headers. It carries no
 * long-lived credential but it IS a bearer capability until `expiresAt`: never log or persist it.
 * A union so another upload mechanism (for example a provider that needs its own client SDK)
 * can be added later without changing callers that handle every `kind`.
 */
export interface UploadTarget {
  readonly kind: 'http-put';
  readonly url: string;
  /**
   * Exactly the headers the client must set on the PUT. The body should be exactly the requested
   * `byteSize` bytes; the client's HTTP stack derives `Content-Length` from it.
   */
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
}

/** What the store knows about an object. Provider response shapes never leak past this. */
export interface StoredObject {
  readonly byteSize: number;
  readonly contentType: string | null;
  readonly etag: string | null;
  readonly lastModified: Date | null;
}

export interface ReadUrlRequest {
  /** Key of a `private` object. Public objects are delivered through `publicUrl`. */
  readonly key: string;
  readonly expiresInSeconds: number;
}

/**
 * The application's whole view of object storage. A provider adapter implements it; use cases
 * `import type` it and are handed an implementation by `composition.ts`.
 *
 * Authorization is NOT a storage concern: the store never decides who may touch which key.
 * Callers resolve ownership from trusted data first and pass the key they derived.
 *
 * Not offered on purpose: listing, copying, server-side writes and multipart. Add one when a
 * real workflow needs it, not before.
 */
export interface ObjectStore {
  /** Whether this store was configured for the visibility. Operations on another one fail. */
  supports(visibility: ObjectVisibility): boolean;

  /**
   * The URL anyone can load a `public` object from, without any I/O. `null` when no public
   * origin is configured, or for a key that is not valid. The object need not exist.
   */
  publicUrl(key: string): string | null;

  createUploadTarget(request: UploadRequest): AppResultAsync<UploadTarget, StorageError>;

  /** `null` when the object does not exist; that is an answer, not a failure. */
  head(location: ObjectLocation): AppResultAsync<StoredObject | null, StorageError>;

  /**
   * At most the first `byteCount` bytes (shorter for a smaller object), for checking what a
   * client really uploaded (file signature) without loading all of it. A missing object is a
   * `not_found` failure.
   */
  readStart(location: ObjectLocation, byteCount: number): AppResultAsync<Uint8Array, StorageError>;

  /** Idempotent: deleting what is already gone succeeds. */
  delete(location: ObjectLocation): AppResultAsync<void, StorageError>;

  /**
   * A short-lived URL to download one `private` object. Does not check that it exists, and is
   * a bearer credential like an upload target: never log or persist it.
   */
  createReadUrl(request: ReadUrlRequest): AppResultAsync<string, StorageError>;
}
