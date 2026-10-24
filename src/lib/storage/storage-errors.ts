import { infrastructureError, notFoundError } from '@lib/errors';
import type {
  AppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';

import type { ObjectVisibility } from './object-store';

/** Stable codes: greppable in logs, and what callers branch on instead of message text. */
export const STORAGE_ERROR_CODES = {
  invalidKey: 'storage.invalid_key',
  invalidRequest: 'storage.invalid_request',
  objectNotFound: 'storage.object_not_found',
  /** Timeouts, throttling, 5xx: trying again later can succeed. */
  unavailable: 'storage.unavailable',
  /** Bad credentials, missing container, denied by policy: retrying cannot help, configuration must change. */
  rejected: 'storage.rejected',
  /** The store was not configured for the requested visibility. */
  visibilityUnavailable: 'storage.visibility_unavailable',
} as const;

/** Every failure an `ObjectStore` returns. Provider SDK errors never cross the boundary: they become `cause`. */
export type StorageError = ValidationAppError | NotFoundAppError | InfrastructureAppError;

export function storageObjectNotFound(): NotFoundAppError {
  return notFoundError(STORAGE_ERROR_CODES.objectNotFound, 'The stored object does not exist.');
}

export function storageUnavailable(cause: unknown): InfrastructureAppError {
  return infrastructureError(
    STORAGE_ERROR_CODES.unavailable,
    'The file storage is temporarily unavailable.',
    cause,
  );
}

export function storageRejected(cause: unknown): InfrastructureAppError {
  return infrastructureError(
    STORAGE_ERROR_CODES.rejected,
    'The file storage rejected the request. Check its configuration.',
    cause,
  );
}

export function storageVisibilityUnavailable(visibility: ObjectVisibility): InfrastructureAppError {
  return infrastructureError(
    STORAGE_ERROR_CODES.visibilityUnavailable,
    `The file storage has no ${visibility} container configured.`,
  );
}

/** Only a transient provider failure is worth retrying; everything else fails the same way again. */
export function isRetryableStorageError(error: AppError): boolean {
  return error.code === STORAGE_ERROR_CODES.unavailable;
}
