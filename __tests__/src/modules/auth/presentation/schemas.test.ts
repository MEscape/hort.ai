import { describe, expect, it } from 'vitest';

import {
  AUTH_VALIDATION_CODES as CODES,
  CREDENTIAL_LIMITS,
} from '@modules/auth/application/contracts/auth-constraints';
import {
  parseEmailVerifiedPageParams,
  parseResetPasswordPageParams,
  parseSignInPageParams,
} from '@modules/auth/presentation/schemas/page-params-schema';
import { requestPasswordResetSchema } from '@modules/auth/presentation/schemas/request-password-reset-schema';
import {
  resetPasswordActionSchema,
  resetPasswordFormSchema,
} from '@modules/auth/presentation/schemas/reset-password-schema';
import { signInSchema } from '@modules/auth/presentation/schemas/sign-in-schema';
import { signUpSchema } from '@modules/auth/presentation/schemas/sign-up-schema';

const PASSWORD = 'four unrelated words are helpful';
const SIGN_UP = {
  role: 'parent',
  name: '  Alex  ',
  email: ' alex@example.test ',
  password: PASSWORD,
  confirmPassword: PASSWORD,
};

describe('authentication presentation schemas', () => {
  it('trims identity fields, preserves password whitespace and drops untrusted tenant fields', () => {
    expect(
      signInSchema.parse({ email: ' alex@example.test ', password: ' secret ', tenantId: 'other' }),
    ).toEqual({ email: 'alex@example.test', password: ' secret ' });
    expect(signUpSchema.parse(SIGN_UP)).toEqual({
      ...SIGN_UP,
      name: 'Alex',
      email: 'alex@example.test',
    });
  });

  it('accepts an existing short password at sign-in but enforces the minimum for new passwords', () => {
    expect(signInSchema.safeParse({ email: 'a@example.test', password: 'old' }).success).toBe(true);
    expect(
      signUpSchema.safeParse({ ...SIGN_UP, password: 'old', confirmPassword: 'old' }).success,
    ).toBe(false);
    expect(
      resetPasswordActionSchema.safeParse({ token: 'valid-token', newPassword: 'old' }).success,
    ).toBe(false);
  });

  it('bounds every credential field and rejects invalid email addresses', () => {
    for (const email of ['', 'not-an-address', 'x'.repeat(CREDENTIAL_LIMITS.emailMax + 1)]) {
      expect(requestPasswordResetSchema.safeParse({ email }).success).toBe(false);
    }
    expect(
      signInSchema.safeParse({
        email: 'a@example.test',
        password: 'x'.repeat(CREDENTIAL_LIMITS.passwordMax + 1),
      }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ ...SIGN_UP, name: 'x'.repeat(CREDENTIAL_LIMITS.nameMax + 1) })
        .success,
    ).toBe(false);
    expect(resetPasswordActionSchema.safeParse({ token: '', newPassword: PASSWORD }).success).toBe(
      false,
    );
  });

  it('attaches mismatches to the confirmation field in registration and recovery', () => {
    for (const parsed of [
      signUpSchema.safeParse({ ...SIGN_UP, confirmPassword: 'different' }),
      resetPasswordFormSchema.safeParse({ newPassword: PASSWORD, confirmPassword: 'different' }),
    ]) {
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues).toContainEqual(
          expect.objectContaining({ path: ['confirmPassword'], message: CODES.passwordMismatch }),
        );
      }
    }
  });

  it('drops repeated tokens and return paths, while treating every error parameter as failure', () => {
    expect(parseSignInPageParams({ returnTo: ['/home', '//evil.test'] })).toEqual({
      returnTo: undefined,
    });
    expect(parseResetPasswordPageParams({ token: ['one', 'two'] })).toEqual({ token: undefined });
    expect(parseResetPasswordPageParams({ token: 'one' })).toEqual({ token: 'one' });
    expect(parseEmailVerifiedPageParams({})).toEqual({ hasFailed: false });
    for (const error of ['', 'expired', ['expired', 'invalid']]) {
      expect(parseEmailVerifiedPageParams({ error })).toEqual({ hasFailed: true });
    }
  });
});
