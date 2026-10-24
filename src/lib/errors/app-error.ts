/**
 * Every error that crosses a layer boundary in this codebase is an
 * `AppError`. Never a bare Error, never a string.
 *
 * `kind` is a discriminated-union tag (typescript.md: "prefer discriminated
 * unions for finite states"). It describes *what happened*, not which
 * transport carried it (errors.md) — so there is no `kind: 'http-500'` or
 * `kind: 'prisma-p2002'` here; those get mapped to one of these kinds at
 * the infrastructure/API boundary instead.
 */
export type AppErrorKind =
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'infrastructure'
  | 'unexpected';

interface BaseAppError {
  readonly kind: AppErrorKind;
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}

export interface ValidationAppError extends BaseAppError {
  readonly kind: 'validation';
  readonly fieldErrors: Record<string, string[]>;
}

export interface NotFoundAppError extends BaseAppError {
  readonly kind: 'not_found';
}

export interface ConflictAppError extends BaseAppError {
  readonly kind: 'conflict';
}

export interface UnauthorizedAppError extends BaseAppError {
  readonly kind: 'unauthorized';
}

export interface ForbiddenAppError extends BaseAppError {
  readonly kind: 'forbidden';
}

/**
 * The caller used an operation more often than its policy allows. It is not a
 * failure of the system and not a permission problem: waiting is the remedy,
 * so the error carries how long (`retryAfterSeconds`, always at least 1).
 */
export interface RateLimitedAppError extends BaseAppError {
  readonly kind: 'rate_limited';
  readonly retryAfterSeconds: number;
}

/**
 * An infrastructure failure that has already been mapped out of its
 * original shape (Prisma error, fetch failure, etc.) before crossing the
 * infrastructure boundary — persistence.md: "keep Prisma-specific errors
 * inside infrastructure". `cause` preserves the original for logging only;
 * `message` must never leak infrastructure detail to a user (api.md).
 */
export interface InfrastructureAppError extends BaseAppError {
  readonly kind: 'infrastructure';
}

/** A genuinely unexpected failure. Represents a caught `throw`, not a business outcome. */
export interface UnexpectedAppError extends BaseAppError {
  readonly kind: 'unexpected';
}

export type AppError =
  | ValidationAppError
  | NotFoundAppError
  | ConflictAppError
  | UnauthorizedAppError
  | ForbiddenAppError
  | RateLimitedAppError
  | InfrastructureAppError
  | UnexpectedAppError;
