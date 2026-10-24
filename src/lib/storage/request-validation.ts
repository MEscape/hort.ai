import { validationError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { STORAGE_ERROR_CODES } from './storage-errors';
import {
  MAX_CACHE_CONTROL_LENGTH,
  MAX_CONTENT_TYPE_LENGTH,
  MAX_OBJECT_KEY_LENGTH,
  MAX_READ_START_BYTES,
  MAX_SIGNED_URL_TTL_SECONDS,
  MAX_UPLOAD_BYTES,
} from './storage-limits';

import type { ReadUrlRequest, UploadRequest } from './object-store';

/**
 * Defence in depth for every adapter: a caller bug or a user-influenced value must not reach
 * the provider as a traversal-like key or an injected header. Callers validate their own
 * inputs first; this is the last line, so it is strict and small.
 */

const KEY_PATTERN = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const DOTS_ONLY = /^\.+$/;
const CONTENT_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;
const CACHE_CONTROL_PATTERN = /^[A-Za-z0-9=, -]+$/;

type Failure = ReturnType<typeof validationError>;

function invalid(code: string, field: string, message: string): Failure {
  return validationError(code, message, { [field]: [message] });
}

export function validateObjectKey(key: string): AppResult<string, Failure> {
  const wellFormed =
    key.length > 0 &&
    key.length <= MAX_OBJECT_KEY_LENGTH &&
    KEY_PATTERN.test(key) &&
    !key.split('/').some((segment) => DOTS_ONLY.test(segment));
  return wellFormed
    ? ok(key)
    : err(
        invalid(
          STORAGE_ERROR_CODES.invalidKey,
          'key',
          'The object key must be segments of letters, digits, ".", "_" or "-" joined by "/".',
        ),
      );
}

function validateTtl(seconds: number): AppResult<number, Failure> {
  return Number.isInteger(seconds) && seconds >= 1 && seconds <= MAX_SIGNED_URL_TTL_SECONDS
    ? ok(seconds)
    : err(
        invalid(
          STORAGE_ERROR_CODES.invalidRequest,
          'expiresInSeconds',
          `The lifetime must be a whole number of seconds between 1 and ${MAX_SIGNED_URL_TTL_SECONDS}.`,
        ),
      );
}

export function validateUploadRequest(request: UploadRequest): AppResult<UploadRequest, Failure> {
  const key = validateObjectKey(request.location.key);
  if (key.isErr()) {
    return err(key.error);
  }

  const code = STORAGE_ERROR_CODES.invalidRequest;
  if (
    request.contentType.length > MAX_CONTENT_TYPE_LENGTH ||
    !CONTENT_TYPE_PATTERN.test(request.contentType)
  ) {
    return err(
      invalid(
        code,
        'contentType',
        'The content type must be a lower-case "type/subtype" without parameters.',
      ),
    );
  }
  if (
    !Number.isInteger(request.byteSize) ||
    request.byteSize < 1 ||
    request.byteSize > MAX_UPLOAD_BYTES
  ) {
    return err(
      invalid(
        code,
        'byteSize',
        `The size must be a whole number of bytes up to ${MAX_UPLOAD_BYTES}.`,
      ),
    );
  }
  if (
    request.cacheControl.length > MAX_CACHE_CONTROL_LENGTH ||
    !CACHE_CONTROL_PATTERN.test(request.cacheControl)
  ) {
    return err(invalid(code, 'cacheControl', 'The cache-control value is not valid.'));
  }
  const ttl = validateTtl(request.expiresInSeconds);
  return ttl.isErr() ? err(ttl.error) : ok(request);
}

export function validateReadUrlRequest(
  request: ReadUrlRequest,
): AppResult<ReadUrlRequest, Failure> {
  const key = validateObjectKey(request.key);
  if (key.isErr()) {
    return err(key.error);
  }
  const ttl = validateTtl(request.expiresInSeconds);
  return ttl.isErr() ? err(ttl.error) : ok(request);
}

export function validateReadStartBytes(byteCount: number): AppResult<number, Failure> {
  return Number.isInteger(byteCount) && byteCount >= 1 && byteCount <= MAX_READ_START_BYTES
    ? ok(byteCount)
    : err(
        invalid(
          STORAGE_ERROR_CODES.invalidRequest,
          'byteCount',
          `The byte count must be a whole number between 1 and ${MAX_READ_START_BYTES}.`,
        ),
      );
}
