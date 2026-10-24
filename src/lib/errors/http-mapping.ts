import { matchAppError } from './factory';

import type { AppError, AppErrorKind } from './app-error';

/**
 * The only place an AppErrorKind is associated with an HTTP status code.
 * Domain and application code never reference status codes
 * (boundaries.md: "HTTP-specific types must not leak into domain or
 * application code") — this file lives in lib/errors specifically so
 * Route Handlers and Server Actions can both use it without either one
 * owning it.
 */
const STATUS_BY_KIND: Record<AppErrorKind, number> = {
  validation: 422,
  not_found: 404,
  conflict: 409,
  unauthorized: 401,
  forbidden: 403,
  rate_limited: 429,
  infrastructure: 502,
  unexpected: 500,
};

export function httpStatusForError(error: AppError): number {
  return STATUS_BY_KIND[error.kind];
}

/**
 * Headers a Route Handler must send with the error's status. Only a
 * rate-limited error has any: `Retry-After` in whole seconds (RFC 9110).
 */
export function httpHeadersForError(error: AppError): Record<string, string> {
  return error.kind === 'rate_limited' ? { 'Retry-After': String(error.retryAfterSeconds) } : {};
}

/**
 * The JSON-safe response body for a Route Handler. `fieldErrors` only
 * appears for validation failures — callers narrow on it the same way
 * they'd narrow any other optional field.
 */
export interface ErrorResponseBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  retryAfterSeconds?: number;
}

/**
 * Builds the JSON-safe response body for a Route Handler. Never includes
 * `cause` — api.md: "do not expose internal exception messages".
 */
export function toErrorResponseBody(error: AppError): ErrorResponseBody {
  return matchAppError(error, {
    validation: (e) => ({
      code: e.code,
      message: e.message,
      fieldErrors: e.fieldErrors,
    }),
    not_found: (e) => ({ code: e.code, message: e.message }),
    conflict: (e) => ({ code: e.code, message: e.message }),
    unauthorized: (e) => ({ code: e.code, message: e.message }),
    forbidden: (e) => ({ code: e.code, message: e.message }),
    rate_limited: (e) => ({
      code: e.code,
      message: e.message,
      retryAfterSeconds: e.retryAfterSeconds,
    }),
    infrastructure: (e) => ({ code: e.code, message: e.message }),
    unexpected: (e) => ({ code: e.code, message: e.message }),
  });
}
