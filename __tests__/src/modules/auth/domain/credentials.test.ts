import { describe, expect, it } from 'vitest';

import {
  CREDENTIAL_LIMITS,
  createPasswordResetDraft,
  createPasswordResetRequest,
  createSignInCredentials,
  createSignUpDraft,
  normalizeEmail,
} from '@modules/auth/domain/models/credentials';

const LONG_ENOUGH = 'p'.repeat(CREDENTIAL_LIMITS.passwordMin);
const MARA = { name: 'Mara', email: 'mara@example.org', password: LONG_ENOUGH, role: 'parent' };

function fieldErrors(result: { readonly isErr: () => boolean; readonly error?: unknown }) {
  const error = result.isErr()
    ? (result.error as { fieldErrors?: Record<string, string[]> })
    : undefined;
  return error?.fieldErrors ?? {};
}

describe('normalizeEmail', () => {
  it('trims and lower-cases, so one address is one account', () => {
    expect(normalizeEmail('  Parent@Example.ORG ')).toBe('parent@example.org');
  });
});

describe('createSignInCredentials', () => {
  it('normalises the address and keeps the password exactly as typed', () => {
    const result = createSignInCredentials({ email: ' A@B.de ', password: ' pass word ' });

    expect(result.isOk() && result.value).toEqual({ email: 'a@b.de', password: ' pass word ' });
  });

  it('does not enforce the new-password policy: an old, shorter password must still sign in', () => {
    expect(createSignInCredentials({ email: 'a@b.de', password: 'short' }).isOk()).toBe(true);
  });

  it('reports every invalid field at once', () => {
    const result = createSignInCredentials({ email: 'nope', password: '' });

    expect(fieldErrors(result)).toEqual({
      email: ['auth.validation.email_invalid'],
      password: ['auth.validation.password_required'],
    });
  });

  it('bounds the size of what it accepts', () => {
    const result = createSignInCredentials({
      email: `${'a'.repeat(CREDENTIAL_LIMITS.emailMax)}@b.de`,
      password: 'p'.repeat(CREDENTIAL_LIMITS.passwordMax + 1),
    });

    expect(fieldErrors(result)).toEqual({
      email: ['auth.validation.email_too_long'],
      password: ['auth.validation.password_too_long'],
    });
  });
});

describe('createSignUpDraft', () => {
  it('trims the name and normalises the address', () => {
    const result = createSignUpDraft({ ...MARA, name: '  Mara  ', email: 'Mara@Example.org' });

    expect(result.isOk() && result.value).toEqual(MARA);
  });

  it('requires a password between the minimum and the maximum length, both ends included', () => {
    const tooShort = createSignUpDraft({ ...MARA, password: LONG_ENOUGH.slice(1) });
    const tooLong = createSignUpDraft({
      ...MARA,
      password: 'p'.repeat(CREDENTIAL_LIMITS.passwordMax + 1),
    });
    const exactlyMax = createSignUpDraft({
      ...MARA,
      password: 'p'.repeat(CREDENTIAL_LIMITS.passwordMax),
    });

    expect(fieldErrors(tooShort)).toEqual({ password: ['auth.validation.password_too_short'] });
    expect(fieldErrors(tooLong)).toEqual({ password: ['auth.validation.password_too_long'] });
    expect(createSignUpDraft(MARA).isOk() && exactlyMax.isOk()).toBe(true);
  });

  it('imposes no composition rules: a long all-lowercase passphrase is fine', () => {
    expect(createSignUpDraft({ ...MARA, password: 'correct horse battery' }).isOk()).toBe(true);
  });

  it('rejects a blank or oversized name', () => {
    expect(fieldErrors(createSignUpDraft({ ...MARA, name: '   ' }))).toEqual({
      name: ['auth.validation.name_required'],
    });
    expect(
      fieldErrors(createSignUpDraft({ ...MARA, name: 'n'.repeat(CREDENTIAL_LIMITS.nameMax + 1) })),
    ).toEqual({ name: ['auth.validation.name_too_long'] });
  });

  it.each(['parent', 'teacher'])('keeps the chosen role %s', (role) => {
    const result = createSignUpDraft({ ...MARA, role });

    expect(result.isOk() && result.value.role).toBe(role);
  });

  it.each(['', 'admin', 'child', 'Parent'])('refuses a role outside the closed set (%j)', (role) => {
    expect(fieldErrors(createSignUpDraft({ ...MARA, role }))?.['role']).toEqual([
      'auth.validation.role_invalid',
    ]);
  });

  it('never echoes the password in the error', () => {
    const result = createSignUpDraft({ name: '', email: 'bad', password: 'secret-value', role: 'parent' });

    expect(JSON.stringify(result.isErr() && result.error)).not.toContain('secret-value');
  });
});

describe('password reset input', () => {
  it('normalises the address of a request', () => {
    const result = createPasswordResetRequest({ email: ' P@E.de ' });

    expect(result.isOk() && result.value).toEqual({ email: 'p@e.de' });
  });

  it('rejects an empty or oversized token, and a new password below the minimum', () => {
    expect(fieldErrors(createPasswordResetDraft({ token: '', newPassword: LONG_ENOUGH }))).toEqual({
      token: ['auth.validation.token_invalid'],
    });
    expect(
      fieldErrors(
        createPasswordResetDraft({
          token: 't'.repeat(CREDENTIAL_LIMITS.tokenMax + 1),
          newPassword: 'short',
        }),
      ),
    ).toEqual({
      token: ['auth.validation.token_invalid'],
      newPassword: ['auth.validation.password_too_short'],
    });
  });

  it('accepts a token and a long enough password', () => {
    expect(createPasswordResetDraft({ token: 'abc', newPassword: LONG_ENOUGH }).isOk()).toBe(true);
  });
});
