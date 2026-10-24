import type { AppError } from '@lib/errors';

import type { AppResult } from './app-result';

/**
 * `Result` instances from neverthrow are class instances with methods —
 * they do not survive serialization across the Server Action boundary
 * intact. `ActionResult` is the plain-object shape Client Components
 * actually receive, per nextjs.md ("Server Actions are framework adapters")
 * and api.md ("map Result values at the boundary, not before").
 *
 * Only serializable error fields are kept: message, a stable code, and
 * optional field-level validation issues. No `cause`, no error instances.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: SerializedActionError };

export interface SerializedActionError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  /** Only for a rate-limited error: seconds until the caller may try again. */
  retryAfterSeconds?: number;
}

/**
 * Converts an application-layer AppResult into the serializable shape a
 * Server Action returns to the client. This is the one place that
 * boundary crossing happens — call it at the end of every Server Action,
 * never inside application/domain code (boundaries.md: application must
 * not import presentation).
 */
export function toActionResult<T, E extends AppError>(result: AppResult<T, E>): ActionResult<T> {
  if (result.isOk()) {
    return { ok: true, data: result.value };
  }

  const error = result.error;
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.kind === 'validation' ? { fieldErrors: error.fieldErrors } : {}),
      ...(error.kind === 'rate_limited' ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
    },
  };
}
