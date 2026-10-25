import type { FieldErrorBag, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { SECONDS_PER_HOUR } from '@lib/utils';

import { AUTH_VALIDATION_CODES, createAuthErrorBag } from '../errors/auth-errors';

import { isRole } from './role';

import type { StoredRole } from './role';

const CODES = AUTH_VALIDATION_CODES;

/** Single definition of every credential limit; forms, the provider and tests derive from it. */
export const CREDENTIAL_LIMITS = {
  emailMax: 254,
  passwordMin: 12,
  passwordMax: 128,
  nameMax: 100,
  tokenMax: 512,
} as const;

/** How long verification and password-reset links stay valid. */
export const AUTH_LINK_LIFETIME_SECONDS = SECONDS_PER_HOUR;

/** Deliberately loose: the real proof of an address is the verification email. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignInInput {
  readonly email: string;
  readonly password: string;
}

export interface SignUpInput {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  /** Chosen once, at registration; stored with the account and never changed by a later request. */
  readonly role: string;
}

export interface PasswordResetRequestInput {
  readonly email: string;
}

export interface PasswordResetInput {
  readonly token: string;
  readonly newPassword: string;
}

/** Validated and normalised: what the authenticator port accepts. */
export interface SignInCredentials {
  readonly email: string;
  readonly password: string;
}

export interface SignUpDraft {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly role: StoredRole;
}

export interface PasswordResetRequest {
  readonly email: string;
}

export interface PasswordResetDraft {
  readonly token: string;
  readonly newPassword: string;
}

/** Addresses are compared case-insensitively everywhere, so normalise once, here. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function emailViolation(email: string): string | null {
  if (email.length === 0) {
    return CODES.emailRequired;
  }
  if (email.length > CREDENTIAL_LIMITS.emailMax) {
    return CODES.emailTooLong;
  }
  if (!EMAIL_PATTERN.test(email)) {
    return CODES.emailInvalid;
  }
  return null;
}

function checkEmail(email: string, bag: FieldErrorBag): void {
  const violation = emailViolation(email);
  if (violation !== null) {
    bag.add('email', violation);
  }
}

/** Sign-in only bounds the size: enforcing the policy there would punish old passwords. */
function checkSubmittedPassword(password: string, bag: FieldErrorBag): void {
  if (password.length === 0) {
    bag.add('password', CODES.passwordRequired);
  } else if (password.length > CREDENTIAL_LIMITS.passwordMax) {
    bag.add('password', CODES.passwordTooLong);
  }
}

/** Length only, no composition rules: they push people toward predictable passwords. */
function checkNewPassword(
  password: string,
  field: 'password' | 'newPassword',
  bag: FieldErrorBag,
): void {
  if (password.length < CREDENTIAL_LIMITS.passwordMin) {
    bag.add(field, CODES.passwordTooShort);
  } else if (password.length > CREDENTIAL_LIMITS.passwordMax) {
    bag.add(field, CODES.passwordTooLong);
  }
}

function checkName(name: string, bag: FieldErrorBag): void {
  if (name.length === 0) {
    bag.add('name', CODES.nameRequired);
  } else if (name.length > CREDENTIAL_LIMITS.nameMax) {
    bag.add('name', CODES.nameTooLong);
  }
}

export function createSignInCredentials(
  input: SignInInput,
): AppResult<SignInCredentials, ValidationAppError> {
  const bag = createAuthErrorBag();
  const email = normalizeEmail(input.email);

  checkEmail(email, bag);
  checkSubmittedPassword(input.password, bag);

  if (bag.hasErrors) {
    return err(bag.toError());
  }
  return ok({ email, password: input.password });
}

/** The only way a new account request enters the system. Reports every invalid field. */
export function createSignUpDraft(input: SignUpInput): AppResult<SignUpDraft, ValidationAppError> {
  const bag = createAuthErrorBag();
  const name = input.name.trim();
  const email = normalizeEmail(input.email);

  checkName(name, bag);
  checkEmail(email, bag);
  checkNewPassword(input.password, 'password', bag);
  const { role } = input;
  if (!isRole(role)) {
    bag.add('role', CODES.roleInvalid);
  }

  if (bag.hasErrors || !isRole(role)) {
    return err(bag.toError());
  }
  return ok({ name, email, password: input.password, role });
}

export function createPasswordResetRequest(
  input: PasswordResetRequestInput,
): AppResult<PasswordResetRequest, ValidationAppError> {
  const bag = createAuthErrorBag();
  const email = normalizeEmail(input.email);

  checkEmail(email, bag);

  if (bag.hasErrors) {
    return err(bag.toError());
  }
  return ok({ email });
}

export function createPasswordResetDraft(
  input: PasswordResetInput,
): AppResult<PasswordResetDraft, ValidationAppError> {
  const bag = createAuthErrorBag();

  if (input.token.length === 0 || input.token.length > CREDENTIAL_LIMITS.tokenMax) {
    bag.add('token', CODES.tokenInvalid);
  }
  checkNewPassword(input.newPassword, 'newPassword', bag);

  if (bag.hasErrors) {
    return err(bag.toError());
  }
  return ok({ token: input.token, newPassword: input.newPassword });
}
