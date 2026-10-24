import { APIError } from 'better-auth/api';
import { describe, expect, it } from 'vitest';

import { providerFailed } from '@modules/auth/domain/errors/auth-errors';
import { mapBetterAuthError } from '@modules/auth/infrastructure/better-auth/map-better-auth-error';

function provider(status: ConstructorParameters<typeof APIError>[0], code?: string) {
  return new APIError(status, {
    message: 'provider text that must not leak',
    ...(code ? { code } : {}),
  });
}

const map = (thrown: unknown) => mapBetterAuthError(thrown, providerFailed);

describe('mapBetterAuthError', () => {
  it.each([
    'INVALID_EMAIL_OR_PASSWORD',
    'INVALID_PASSWORD',
    'USER_NOT_FOUND',
    'CREDENTIAL_ACCOUNT_NOT_FOUND',
  ])(
    'reports %s as the one invalid-credentials outcome, so no account can be told from another',
    (code) => {
      expect(map(provider('UNAUTHORIZED', code))).toMatchObject({
        kind: 'unauthorized',
        code: 'auth.invalid_credentials',
      });
    },
  );

  it('reports an unconfirmed address only as such (the provider raises it after the password matched)', () => {
    expect(map(provider('FORBIDDEN', 'EMAIL_NOT_VERIFIED'))).toMatchObject({
      kind: 'forbidden',
      code: 'auth.email_not_verified',
    });
  });

  it.each(['INVALID_TOKEN', 'TOKEN_EXPIRED'])('reports %s as one invalid-link outcome', (code) => {
    expect(map(provider('BAD_REQUEST', code))).toMatchObject({
      kind: 'unauthorized',
      code: 'auth.invalid_token',
    });
  });

  it('asks for a fresh sign-in when a still-valid session is too old for a sensitive change', () => {
    expect(map(provider('FORBIDDEN', 'SESSION_NOT_FRESH'))).toMatchObject({
      code: 'auth.reauthentication_required',
    });
  });

  it('maps a duplicate account to a conflict that is never shown', () => {
    expect(map(provider('UNPROCESSABLE_ENTITY', 'USER_ALREADY_EXISTS'))).toMatchObject({
      kind: 'conflict',
      code: 'auth.account_conflict',
    });
  });

  it('reads a bare 401 with no code as "not signed in"', () => {
    expect(map(provider('UNAUTHORIZED'))).toMatchObject({ code: 'auth.unauthenticated' });
  });

  it('fails closed on a provider code nobody classified, without exposing its text', () => {
    const result = map(provider('INTERNAL_SERVER_ERROR', 'SOMETHING_NEW'));

    expect(result).toMatchObject({ kind: 'infrastructure', code: 'auth.provider_failed' });
    expect(result.message).not.toContain('provider text');
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'does not let the code %j resolve through the prototype chain',
    (code) => {
      expect(map(provider('BAD_REQUEST', code))).toMatchObject({ kind: 'infrastructure' });
    },
  );

  it('fails closed on anything that is not a provider error, keeping it as the cause', () => {
    const cause = new Error('connect ECONNREFUSED');

    const result = map(cause);

    expect(result).toMatchObject({ kind: 'infrastructure', code: 'auth.provider_failed', cause });
    expect(result.message).not.toContain('ECONNREFUSED');
  });
});
