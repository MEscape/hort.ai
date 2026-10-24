import { isAPIError } from 'better-auth/api';

import type { AppError, InfrastructureAppError } from '@lib/errors';
import { logger } from '@lib/logger';
import { assertNever, isDefined, isString, objectOf } from '@lib/utils';

import {
  accountConflict,
  authValidationFailed,
  emailNotVerified,
  invalidCredentials,
  invalidToken,
  reauthenticationRequired,
  unauthenticated,
} from '../../domain/errors/auth-errors';

const authLogger = logger.withContext({ module: 'auth.better-auth' });

/**
 * What a Better Auth `body.code` means to us.
 *
 * - `credential_failure`: unknown account or wrong password. All map to one
 *   outcome so this mapper cannot become a user-enumeration oracle.
 * - `reauthentication`: thrown by the "fresh session" guards when a
 *   still-valid session is too old for a sensitive change. A genuinely
 *   expired session never errors: `getSession` returns null and the caller
 *   sees `unauthenticated`.
 * - `token`: email-verification and password-reset tokens, not sessions.
 * - `email_not_verified`: thrown only AFTER the password was verified, so it
 *   does not reveal whether an address is registered.
 * - `conflict`: with `requireEmailVerification` sign-up returns a generic
 *   success for an existing address instead of throwing USER_ALREADY_EXISTS*,
 *   so these reach us only from authenticated flows such as account linking.
 * - `validation`: malformed input.
 */
type ProviderCodeClass =
  | 'credential_failure'
  | 'reauthentication'
  | 'token'
  | 'email_not_verified'
  | 'conflict'
  | 'validation';

/**
 * Better Auth's stable `body.code` strings (BASE_ERROR_CODES in
 * @better-auth/core). Matching on the code, not the human message, keeps
 * this mapper correct if the wording changes. This is an allowlist: a code
 * we have not classified falls through to an infrastructure error rather
 * than being guessed at. A `Map` keeps a provider-supplied code such as
 * "constructor" from resolving through the prototype chain.
 */
const PROVIDER_CODE_CLASSES: ReadonlyMap<string, ProviderCodeClass> = new Map<
  string,
  ProviderCodeClass
>([
  ['INVALID_EMAIL_OR_PASSWORD', 'credential_failure'],
  ['INVALID_PASSWORD', 'credential_failure'],
  ['USER_NOT_FOUND', 'credential_failure'],
  ['CREDENTIAL_ACCOUNT_NOT_FOUND', 'credential_failure'],
  ['INVALID_USER', 'credential_failure'],
  ['SESSION_EXPIRED', 'reauthentication'],
  ['SESSION_NOT_FRESH', 'reauthentication'],
  ['INVALID_TOKEN', 'token'],
  ['TOKEN_EXPIRED', 'token'],
  ['EMAIL_NOT_VERIFIED', 'email_not_verified'],
  ['USER_ALREADY_EXISTS', 'conflict'],
  ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'conflict'],
  ['LINKED_ACCOUNT_ALREADY_EXISTS', 'conflict'],
  ['SOCIAL_ACCOUNT_ALREADY_LINKED', 'conflict'],
  ['INVALID_EMAIL', 'validation'],
  ['PASSWORD_TOO_SHORT', 'validation'],
  ['PASSWORD_TOO_LONG', 'validation'],
  ['VALIDATION_ERROR', 'validation'],
  ['MISSING_FIELD', 'validation'],
  ['FIELD_NOT_ALLOWED', 'validation'],
  ['BODY_MUST_BE_AN_OBJECT', 'validation'],
]);

/** HTTP status Better Auth reports for "no valid session". */
const UNAUTHORIZED_STATUS_CODE = 401;

/** `body` comes from an external library, so its shape is parsed, not assumed (validation.md). */
const isProviderErrorBody = objectOf<{ readonly code: string }>({ code: isString });

/**
 * `body` is `undefined` for some failures (better-auth issue #7178 shows an
 * UNAUTHORIZED APIError with no body), so absence is a normal outcome.
 */
function readProviderCode(body: unknown): string | undefined {
  return isProviderErrorBody(body) ? body.code : undefined;
}

function fromCodeClass(codeClass: ProviderCodeClass): AppError {
  switch (codeClass) {
    case 'credential_failure':
      return invalidCredentials();
    case 'reauthentication':
      return reauthenticationRequired();
    case 'token':
      return invalidToken();
    case 'email_not_verified':
      return emailNotVerified();
    case 'conflict':
      return accountConflict();
    case 'validation':
      return authValidationFailed({});
    default:
      return assertNever(codeClass);
  }
}

/**
 * Maps anything thrown by Better Auth into one of our AppErrors. This is
 * the error-mapping boundary for authentication, the counterpart of
 * `createPersistenceFailures` for persistence: provider failures are an
 * infrastructure concern and must not reach the application or domain.
 * Adapters call it from their catch blocks.
 *
 * `onUnclassified` builds the infrastructure error for failures that have
 * no meaning of their own, so each adapter keeps its own stable code
 * (`sessionLookupFailed`, `providerFailed`).
 *
 * Fail-closed by construction. A failure that is not a recognized
 * `APIError` becomes an infrastructure error, which callers treat as a
 * failure, never as success or as "unauthenticated". An `APIError` whose
 * code we have not classified is handled the same way, so a new
 * provider error can never be mistaken for a benign outcome.
 */
export function mapBetterAuthError(
  thrown: unknown,
  onUnclassified: (cause: unknown) => InfrastructureAppError,
): AppError {
  if (!isAPIError(thrown)) {
    return onUnclassified(thrown);
  }

  const code = readProviderCode(thrown.body);
  const codeClass = code === undefined ? undefined : PROVIDER_CODE_CLASSES.get(code);
  if (isDefined(codeClass)) {
    return fromCodeClass(codeClass);
  }

  // A bare 401 with no recognizable code means "no valid session".
  if (thrown.statusCode === UNAUTHORIZED_STATUS_CODE) {
    return unauthenticated();
  }

  const fallback = onUnclassified(thrown);
  authLogger.warn('auth.unclassified_provider_error', {
    mappedTo: fallback.code,
    status: thrown.status,
    providerCode: code,
  });
  return fallback;
}
