import {
  FieldErrorBag,
  conflictError,
  forbiddenError,
  infrastructureError,
  rateLimitedError,
  unauthorizedError,
  validationError,
} from '@lib/errors';
import type {
  ConflictAppError,
  ForbiddenAppError,
  InfrastructureAppError,
  RateLimitedAppError,
  UnauthorizedAppError,
  ValidationAppError,
} from '@lib/errors';
import type { RateLimitFailure } from '@lib/rate-limit';

/**
 * Stable codes. Presentation maps these to translation keys (i18n.md);
 * nothing here is user-facing prose. Every code the module can emit lives
 * here, including infrastructure ones, so the message table in
 * presentation (`satisfies Record<AuthCode, string>`) cannot miss one.
 *
 * There is deliberately ONE code for every authorization denial. Codes
 * reach the client (`toActionResult`, `toErrorResponseBody`), so a separate
 * "wrong tenant" code would tell a caller that the resource exists in
 * another tenant. The precise reason goes to the security audit log
 * instead, never to the caller.
 */
export const AUTH_ERROR_CODES = {
  unauthenticated: 'auth.unauthenticated',
  invalidCredentials: 'auth.invalid_credentials',
  sessionExpired: 'auth.session_expired',
  reauthenticationRequired: 'auth.reauthentication_required',
  invalidToken: 'auth.invalid_token',
  emailNotVerified: 'auth.email_not_verified',
  permissionDenied: 'auth.permission_denied',
  rateLimited: 'auth.rate_limited',
  validationFailed: 'auth.validation_failed',
  accountConflict: 'auth.account_conflict',
  sessionLookupFailed: 'auth.session_lookup_failed',
  providerFailed: 'auth.provider_failed',
  rateLimiterFailed: 'auth.rate_limiter_failed',
  mailerNotConfigured: 'auth.mailer_not_configured',
  mailDeliveryFailed: 'auth.mail_delivery_failed',
} as const;

/** Field-level codes, carried in `fieldErrors`. Also stable, also never prose. */
export const AUTH_VALIDATION_CODES = {
  emailRequired: 'auth.validation.email_required',
  emailInvalid: 'auth.validation.email_invalid',
  emailTooLong: 'auth.validation.email_too_long',
  passwordRequired: 'auth.validation.password_required',
  passwordTooShort: 'auth.validation.password_too_short',
  passwordTooLong: 'auth.validation.password_too_long',
  /** Enforced at the form boundary only: the server never needs a second password. */
  passwordMismatch: 'auth.validation.password_mismatch',
  nameRequired: 'auth.validation.name_required',
  nameTooLong: 'auth.validation.name_too_long',
  roleInvalid: 'auth.validation.role_invalid',
  tokenInvalid: 'auth.validation.token_invalid',
  tenantInvalid: 'auth.validation.tenant_invalid',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];
export type AuthValidationCode = (typeof AUTH_VALIDATION_CODES)[keyof typeof AUTH_VALIDATION_CODES];
export type AuthCode = AuthErrorCode | AuthValidationCode;

/** No valid session: the caller is simply not signed in. */
export function unauthenticated(): UnauthorizedAppError {
  return unauthorizedError(AUTH_ERROR_CODES.unauthenticated, 'Authentication is required.');
}

/**
 * One message for "no such account" and "wrong password": telling them
 * apart enables user enumeration.
 */
export function invalidCredentials(): UnauthorizedAppError {
  return unauthorizedError(AUTH_ERROR_CODES.invalidCredentials, 'The credentials are invalid.');
}

/** The session outlived our absolute lifetime cap; a fresh sign-in is required. */
export function sessionExpired(): UnauthorizedAppError {
  return unauthorizedError(AUTH_ERROR_CODES.sessionExpired, 'The session has expired.');
}

/**
 * The session is valid but too old for a sensitive operation (changing the
 * password or email). Different from `sessionExpired`: the user is still
 * signed in and only needs to confirm their credentials again.
 */
export function reauthenticationRequired(): UnauthorizedAppError {
  return unauthorizedError(
    AUTH_ERROR_CODES.reauthenticationRequired,
    'Recent authentication is required for this action.',
  );
}

/** Verification and password-reset tokens: expired and invalid share one outcome. */
export function invalidToken(): UnauthorizedAppError {
  return unauthorizedError(AUTH_ERROR_CODES.invalidToken, 'The link is invalid or has expired.');
}

/**
 * Only reachable after the password was verified, so it cannot be used to
 * probe which emails are registered.
 */
export function emailNotVerified(): ForbiddenAppError {
  return forbiddenError(
    AUTH_ERROR_CODES.emailNotVerified,
    'The email address has not been verified.',
  );
}

/**
 * The single denial for every authorization failure; the precise reason
 * goes to the audit log, never to the caller.
 */
export function permissionDenied(): ForbiddenAppError {
  return forbiddenError(
    AUTH_ERROR_CODES.permissionDenied,
    'You are not allowed to perform this action.',
  );
}

/** Too many attempts for one subject in the current window; `retryAfterSeconds` says how long to wait. */
export function rateLimited(retryAfterSeconds: number): RateLimitedAppError {
  return rateLimitedError(
    AUTH_ERROR_CODES.rateLimited,
    'Too many attempts. Try again later.',
    retryAfterSeconds,
  );
}

/** Never shown to the client: a duplicate account must stay indistinguishable. */
export function accountConflict(): ConflictAppError {
  return conflictError(AUTH_ERROR_CODES.accountConflict, 'The account could not be created.');
}

export function authValidationFailed(fieldErrors: Record<string, string[]>): ValidationAppError {
  return validationError(
    AUTH_ERROR_CODES.validationFailed,
    'The authentication input is invalid.',
    fieldErrors,
  );
}

/** One place wires the bag to this module's error factory. */
export function createAuthErrorBag(): FieldErrorBag {
  return new FieldErrorBag(authValidationFailed);
}

export function sessionLookupFailed(cause: unknown): InfrastructureAppError {
  return infrastructureError(
    AUTH_ERROR_CODES.sessionLookupFailed,
    'The session could not be verified.',
    cause,
  );
}

/** The authentication provider failed in a way that fits no other code. */
export function providerFailed(cause: unknown): InfrastructureAppError {
  return infrastructureError(
    AUTH_ERROR_CODES.providerFailed,
    'The authentication provider failed.',
    cause,
  );
}

export function rateLimiterFailed(cause: unknown): InfrastructureAppError {
  return infrastructureError(
    AUTH_ERROR_CODES.rateLimiterFailed,
    'The rate limit could not be checked.',
    cause,
  );
}

/** A refusal of the shared limiter, in this module's own codes, so its message table stays complete. */
export function fromRateLimitFailure(
  failure: RateLimitFailure,
): RateLimitedAppError | InfrastructureAppError {
  return failure.kind === 'rate_limited'
    ? rateLimited(failure.retryAfterSeconds)
    : rateLimiterFailed(failure.cause);
}

export function mailerNotConfigured(): InfrastructureAppError {
  return infrastructureError(
    AUTH_ERROR_CODES.mailerNotConfigured,
    'No email transport is configured for authentication emails.',
  );
}

/**
 * A message the transport could not deliver. The transport's own error (its code is shared by every
 * module that sends mail) is kept as the cause, so the log still names it, while the code the user
 * interface sees is this module's.
 */
export function mailDeliveryFailed(cause: unknown): InfrastructureAppError {
  return infrastructureError(
    AUTH_ERROR_CODES.mailDeliveryFailed,
    'The authentication email could not be delivered.',
    cause,
  );
}

/** The configured tenant id is not a valid one. */
export function tenantInvalid(): ValidationAppError {
  const bag = createAuthErrorBag();
  bag.add('tenantId', AUTH_VALIDATION_CODES.tenantInvalid);
  return bag.toError();
}
