import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors';
import type { NestedKeyOf } from '@lib/errors';

import {
  AUTH_ERROR_CODES as ERRORS,
  AUTH_VALIDATION_CODES as VALIDATION,
  CREDENTIAL_LIMITS,
} from '../../application/contracts/auth-constraints';

import type { AuthCode } from '../../application/contracts/auth-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['auth']>;

/**
 * Codes -> translation keys. Keys are absolute (the `auth` namespace is part of the key).
 * `satisfies Record<AuthCode, ...>` makes a new code fail to compile until it has a message.
 *
 * `accountConflict` and the provider and mailer failures deliberately get the generic messages:
 * the precise reason must not reach the client.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.unauthenticated]: fieldPath('errors', 'unauthenticated'),
  [ERRORS.invalidCredentials]: fieldPath('errors', 'invalidCredentials'),
  [ERRORS.sessionExpired]: fieldPath('errors', 'sessionExpired'),
  [ERRORS.reauthenticationRequired]: fieldPath('errors', 'reauthenticationRequired'),
  [ERRORS.invalidToken]: fieldPath('errors', 'invalidToken'),
  [ERRORS.emailNotVerified]: fieldPath('errors', 'emailNotVerified'),
  [ERRORS.permissionDenied]: fieldPath('errors', 'permissionDenied'),
  [ERRORS.rateLimited]: fieldPath('errors', 'rateLimited'),
  [ERRORS.validationFailed]: fieldPath('errors', 'validation'),
  [ERRORS.accountConflict]: fieldPath('errors', 'unexpected'),
  [ERRORS.sessionLookupFailed]: fieldPath('errors', 'infrastructure'),
  [ERRORS.providerFailed]: fieldPath('errors', 'infrastructure'),
  [ERRORS.rateLimiterFailed]: fieldPath('errors', 'infrastructure'),
  [ERRORS.mailerNotConfigured]: fieldPath('errors', 'infrastructure'),
  [ERRORS.mailDeliveryFailed]: fieldPath('errors', 'infrastructure'),
  [VALIDATION.emailRequired]: fieldPath('validation', 'emailRequired'),
  [VALIDATION.emailInvalid]: fieldPath('validation', 'emailInvalid'),
  [VALIDATION.emailTooLong]: fieldPath('validation', 'emailTooLong'),
  [VALIDATION.passwordRequired]: fieldPath('validation', 'passwordRequired'),
  [VALIDATION.passwordTooShort]: fieldPath('validation', 'passwordTooShort'),
  [VALIDATION.passwordTooLong]: fieldPath('validation', 'passwordTooLong'),
  [VALIDATION.passwordMismatch]: fieldPath('validation', 'passwordMismatch'),
  [VALIDATION.nameRequired]: fieldPath('validation', 'nameRequired'),
  [VALIDATION.nameTooLong]: fieldPath('validation', 'nameTooLong'),
  [VALIDATION.roleInvalid]: fieldPath('validation', 'roleInvalid'),
  [VALIDATION.tokenInvalid]: fieldPath('validation', 'tokenInvalid'),
  [VALIDATION.tenantInvalid]: fieldPath('validation', 'tenantInvalid'),
} as const satisfies Record<AuthCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

export type MessageKey = (typeof MESSAGE_KEY_BY_CODE)[AuthCode];

function isAuthCode(code: string): code is AuthCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/**
 * Codes from other modules or from Zod's own structural messages are unknown here and get the
 * generic message.
 */
export function messageKeyForCode(code: string): MessageKey {
  return isAuthCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}

/** Interpolation values for messages that mention a limit. */
export const MESSAGE_PARAMS = {
  emailMax: CREDENTIAL_LIMITS.emailMax,
  passwordMin: CREDENTIAL_LIMITS.passwordMin,
  passwordMax: CREDENTIAL_LIMITS.passwordMax,
  nameMax: CREDENTIAL_LIMITS.nameMax,
} as const;
