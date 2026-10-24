import { z } from 'zod';

import {
  AUTH_VALIDATION_CODES as CODES,
  CREDENTIAL_LIMITS,
  EMAIL_PATTERN,
} from '../../application/contracts/auth-constraints';

/**
 * Field schemas shared by every auth form. Messages are stable codes,
 * never prose: the UI translates them (i18n.md). Limits come from the
 * domain constants, so a number is defined exactly once.
 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: CODES.emailRequired })
  .max(CREDENTIAL_LIMITS.emailMax, { message: CODES.emailTooLong })
  .regex(EMAIL_PATTERN, { message: CODES.emailInvalid });

export const nameSchema = z
  .string()
  .trim()
  .min(1, { message: CODES.nameRequired })
  .max(CREDENTIAL_LIMITS.nameMax, { message: CODES.nameTooLong });

/** For signing in: bounds the size only, never the policy. */
export const submittedPasswordSchema = z
  .string()
  .min(1, { message: CODES.passwordRequired })
  .max(CREDENTIAL_LIMITS.passwordMax, { message: CODES.passwordTooLong });

/** For choosing a password. Not trimmed: spaces are legitimate password characters. */
export const newPasswordSchema = z
  .string()
  .min(CREDENTIAL_LIMITS.passwordMin, { message: CODES.passwordTooShort })
  .max(CREDENTIAL_LIMITS.passwordMax, { message: CODES.passwordTooLong });

export const tokenSchema = z
  .string()
  .min(1, { message: CODES.tokenInvalid })
  .max(CREDENTIAL_LIMITS.tokenMax, { message: CODES.tokenInvalid });
