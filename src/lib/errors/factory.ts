import type {
  AppError,
  ConflictAppError,
  ForbiddenAppError,
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  UnauthorizedAppError,
  UnexpectedAppError,
  ValidationAppError,
} from './app-error';

/**
 * One constructor per error kind. Prefer these over hand-building an
 * AppError object at call sites — keeps the shape consistent and gives
 * every error site a stable `code` for logging/telemetry
 * (observability.md: "include request/correlation identifiers", and
 * codes make errors greppable across logs).
 */

export function validationError(
  code: string,
  message: string,
  fieldErrors: Record<string, string[]>,
): ValidationAppError {
  return { kind: 'validation', code, message, fieldErrors };
}

export function notFoundError(code: string, message: string): NotFoundAppError {
  return { kind: 'not_found', code, message };
}

export function conflictError(code: string, message: string): ConflictAppError {
  return { kind: 'conflict', code, message };
}

export function unauthorizedError(code: string, message: string): UnauthorizedAppError {
  return { kind: 'unauthorized', code, message };
}

export function forbiddenError(code: string, message: string): ForbiddenAppError {
  return { kind: 'forbidden', code, message };
}

/** `retryAfterSeconds` is rounded up to a whole second and is never below 1. */
export function rateLimitedError(
  code: string,
  message: string,
  retryAfterSeconds: number,
): RateLimitedAppError {
  return {
    kind: 'rate_limited',
    code,
    message,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterSeconds)),
  };
}

/**
 * `message` here is what gets shown to the user via api.md's "do not
 * expose internal exception messages" — pass a safe, generic message and
 * put the real diagnostic detail in `cause`.
 */
export function infrastructureError(
  code: string,
  message: string,
  cause?: unknown,
): InfrastructureAppError {
  return { kind: 'infrastructure', code, message, cause };
}

export function unexpectedError(
  code: string,
  message: string,
  cause?: unknown,
): UnexpectedAppError {
  return { kind: 'unexpected', code, message, cause };
}

/**
 * Exhaustive mapping helper. Passing a handler for every AppErrorKind is
 * enforced at compile time (typescript.md: "use exhaustive checks so
 * adding a new variant produces compile-time errors") — this is the
 * function api.md's Result-to-HTTP-status mapping is built on.
 */
export function matchAppError<T>(
  error: AppError,
  handlers: {
    [K in AppError['kind']]: (error: Extract<AppError, { kind: K }>) => T;
  },
): T {
  // TS cannot narrow `handlers[error.kind]` to a single call signature
  // through an indexed access on a mapped type; the runtime invariant
  // (every handler key matches its own error's `kind`) is what the
  // `[K in AppError['kind']]` constraint on `handlers` already enforces
  // at the call site, so this cast just states that guarantee to the
  // compiler at the one point it can't see it itself.
  const handler = handlers[error.kind] as (error: AppError) => T;
  return handler(error);
}
