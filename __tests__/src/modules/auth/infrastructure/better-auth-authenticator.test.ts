import { APIError } from 'better-auth/api';
import { describe, expect, it } from 'vitest';

import type { AuthenticationApi } from '@modules/auth/infrastructure/better-auth/better-auth-authentication-api';
import { BetterAuthAuthenticator } from '@modules/auth/infrastructure/better-auth/better-auth-authenticator';

interface Call {
  readonly method: string;
  readonly input: Record<string, unknown>;
}

const PATHS = { afterEmailVerification: '/email-verified', passwordReset: '/reset-password' };
const HEADERS = new Headers({ 'x-request': 'abc' });

/** An API that records what it was asked and fails each method with `thrown` (or succeeds with a token it must not leak). */
function fakeApi(thrown?: Error) {
  const calls: Call[] = [];
  const respond = (method: string) => (input: Record<string, unknown>) => {
    calls.push({ method, input });
    return thrown === undefined
      ? Promise.resolve({ token: 'SESSION-TOKEN-THAT-MUST-NOT-ESCAPE' })
      : Promise.reject(thrown);
  };
  const api: AuthenticationApi = {
    signInEmail: respond('signInEmail'),
    signUpEmail: respond('signUpEmail'),
    signOut: respond('signOut'),
    requestPasswordReset: respond('requestPasswordReset'),
    resetPassword: respond('resetPassword'),
  };
  return { api, calls };
}

function build(thrown?: Error) {
  const { api, calls } = fakeApi(thrown);
  const authenticator = new BetterAuthAuthenticator({
    api,
    getHeaders: () => Promise.resolve(HEADERS),
    paths: PATHS,
  });
  return { authenticator, calls };
}

const provider = (status: ConstructorParameters<typeof APIError>[0], code: string) =>
  new APIError(status, { message: 'provider text', code });

describe('BetterAuthAuthenticator.signIn', () => {
  it('passes the credentials and the request headers on, and where a verification link should land', async () => {
    const { authenticator, calls } = build();

    const result = await authenticator.signIn({ email: 'mara@example.org', password: 'pw' });

    expect(calls).toEqual([
      {
        method: 'signInEmail',
        input: {
          email: 'mara@example.org',
          password: 'pw',
          callbackURL: '/email-verified',
          headers: HEADERS,
        },
      },
    ]);
    expect(result.isOk()).toBe(true);
  });

  it('never hands a session token to the application', async () => {
    const { authenticator } = build();

    const result = await authenticator.signIn({ email: 'mara@example.org', password: 'pw' });

    expect(result.isOk() && result.value).toBeUndefined();
  });

  it('reports a wrong password and an unknown account as the same failure', async () => {
    const wrongPassword = await build(
      provider('UNAUTHORIZED', 'INVALID_PASSWORD'),
    ).authenticator.signIn({
      email: 'a@b.de',
      password: 'pw',
    });
    const unknownAccount = await build(
      provider('UNAUTHORIZED', 'USER_NOT_FOUND'),
    ).authenticator.signIn({
      email: 'c@d.de',
      password: 'pw',
    });

    expect(wrongPassword).toEqual(unknownAccount);
    expect(wrongPassword.isErr() && wrongPassword.error.code).toBe('auth.invalid_credentials');
  });

  it('reports an unconfirmed address as forbidden', async () => {
    const { authenticator } = build(provider('FORBIDDEN', 'EMAIL_NOT_VERIFIED'));

    const result = await authenticator.signIn({ email: 'a@b.de', password: 'pw' });

    expect(result.isErr() && result.error).toMatchObject({ kind: 'forbidden' });
  });

  it('fails closed, with the original error only as the cause, when the provider breaks', async () => {
    const cause = new Error('password authentication failed for user "hortai"');
    const { authenticator } = build(cause);

    const result = await authenticator.signIn({ email: 'a@b.de', password: 'pw' });

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'infrastructure',
      code: 'auth.provider_failed',
      cause,
    });
    expect(result.isErr() && result.error.message).not.toContain('hortai');
  });

  it('turns a failure to read the request headers into a failure, not a throw', async () => {
    const { api } = fakeApi();
    const authenticator = new BetterAuthAuthenticator({
      api,
      getHeaders: () => {
        throw new Error('outside a request');
      },
      paths: PATHS,
    });

    const result = await authenticator.signIn({ email: 'a@b.de', password: 'pw' });

    expect(result.isErr() && result.error.kind).toBe('infrastructure');
  });
});

describe('BetterAuthAuthenticator.signUp', () => {
  const draft = { name: 'Mara', email: 'mara@example.org', password: 'a-long-enough-password' };

  it('creates the account through the provider', async () => {
    const { authenticator, calls } = build();

    const result = await authenticator.signUp(draft);

    expect(result.isOk()).toBe(true);
    expect(calls[0]).toMatchObject({
      method: 'signUpEmail',
      input: { ...draft, callbackURL: '/email-verified' },
    });
  });

  it('answers success for an address that already has an account, so sign-up cannot enumerate', async () => {
    const { authenticator } = build(provider('UNPROCESSABLE_ENTITY', 'USER_ALREADY_EXISTS'));

    const result = await authenticator.signUp(draft);

    expect(result.isOk()).toBe(true);
  });

  it('still reports a real provider failure', async () => {
    const { authenticator } = build(new Error('down'));

    const result = await authenticator.signUp(draft);

    expect(result.isErr() && result.error.code).toBe('auth.provider_failed');
  });
});

describe('BetterAuthAuthenticator.signOut', () => {
  it('ends the session the request carries', async () => {
    const { authenticator, calls } = build();

    const result = await authenticator.signOut();

    expect(result.isOk()).toBe(true);
    expect(calls).toEqual([{ method: 'signOut', input: { headers: HEADERS } }]);
  });

  it('succeeds when nobody is signed in', async () => {
    const { authenticator } = build(provider('UNAUTHORIZED', 'SESSION_NOT_FOUND'));

    const result = await authenticator.signOut();

    expect(result.isOk()).toBe(true);
  });

  it('reports a provider that is down instead of pretending the session ended', async () => {
    const { authenticator } = build(new Error('down'));

    const result = await authenticator.signOut();

    expect(result.isErr() && result.error.kind).toBe('infrastructure');
  });
});

describe('BetterAuthAuthenticator password reset', () => {
  it('asks for a link that lands on the reset page', async () => {
    const { authenticator, calls } = build();

    await authenticator.requestPasswordReset({ email: 'mara@example.org' });

    expect(calls[0]).toMatchObject({
      method: 'requestPasswordReset',
      input: { email: 'mara@example.org', redirectTo: '/reset-password' },
    });
  });

  it('reports an invalid or expired token as one outcome', async () => {
    const expired = await build(
      provider('BAD_REQUEST', 'TOKEN_EXPIRED'),
    ).authenticator.resetPassword({
      token: 't',
      newPassword: 'a-long-enough-password',
    });
    const invalid = await build(
      provider('BAD_REQUEST', 'INVALID_TOKEN'),
    ).authenticator.resetPassword({
      token: 't',
      newPassword: 'a-long-enough-password',
    });

    expect(expired).toEqual(invalid);
    expect(expired.isErr() && expired.error.code).toBe('auth.invalid_token');
  });
});
