import { describe, expect, it } from 'vitest';

import type { AuthenticationDependencies } from '@modules/auth/application/auth-dependencies';
import { SignUp } from '@modules/auth/application/commands/sign-up';
import { AUTH_RATE_LIMITS } from '@modules/auth/application/rate-limits';
import { providerFailed } from '@modules/auth/domain/errors/auth-errors';

import { createBrokenRateLimiter, createTestRateLimiter } from '../../../support/rate-limiting';
import { clientAt, fakeAuthenticator, recordingAudit } from '../fakes';

const PASSWORD = 'a-long-enough-password';
const MARA = { name: 'Mara', email: 'mara@example.org', password: PASSWORD };

function build(overrides: Partial<AuthenticationDependencies> = {}) {
  const authenticator = fakeAuthenticator();
  const deps: AuthenticationDependencies = {
    authenticator,
    rateLimiter: createTestRateLimiter(),
    clientAddress: clientAt('203.0.113.7'),
    audit: recordingAudit(),
    ...overrides,
  };
  return { signUp: new SignUp(deps), authenticator };
}

describe('SignUp', () => {
  it('hands the provider a trimmed name and a normalised address', async () => {
    const { signUp, authenticator } = build();

    const result = await signUp.execute({ ...MARA, name: '  Mara ', email: 'Mara@Example.ORG' });

    expect(result.isOk()).toBe(true);
    expect(authenticator.calls).toEqual([{ flow: 'signUp', input: MARA }]);
  });

  it('refuses a password below the minimum before anything else happens', async () => {
    const { signUp, authenticator } = build();

    const result = await signUp.execute({ ...MARA, password: 'short' });

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'validation',
      fieldErrors: { password: ['auth.validation.password_too_short'] },
    });
    expect(authenticator.calls).toEqual([]);
  });

  it('answers the same whether or not the address already has an account', async () => {
    // The provider adapter reports an existing account as success (enumeration protection); the
    // use case must add nothing that tells the two apart.
    const first = build();
    const second = build();

    const created = await first.signUp.execute(MARA);
    const repeated = await second.signUp.execute(MARA);

    expect(created).toEqual(repeated);
  });

  it('allows an address a handful of attempts per hour, then waits', async () => {
    const { signUp, authenticator } = build();
    for (let attempt = 0; attempt < AUTH_RATE_LIMITS.signUp.limit; attempt += 1) {
      await signUp.execute(MARA);
    }

    const result = await signUp.execute(MARA);

    expect(result.isErr() && result.error.kind).toBe('rate_limited');
    expect(authenticator.calls).toHaveLength(AUTH_RATE_LIMITS.signUp.limit);
  });

  it('limits one client address across many addresses', async () => {
    const { signUp, authenticator } = build();
    for (let attempt = 0; attempt < AUTH_RATE_LIMITS.signUpClient.limit; attempt += 1) {
      await signUp.execute({ ...MARA, email: `parent-${attempt}@example.org` });
    }

    const result = await signUp.execute({ ...MARA, email: 'one-more@example.org' });

    expect(result.isErr() && result.error.kind).toBe('rate_limited');
    expect(authenticator.calls).toHaveLength(AUTH_RATE_LIMITS.signUpClient.limit);
  });

  it('passes a provider failure on as an infrastructure error without its cause in the message', async () => {
    const authenticator = fakeAuthenticator(
      providerFailed(new Error('connect ECONNREFUSED db:5432')),
    );
    const { signUp } = build({ authenticator });

    const result = await signUp.execute(MARA);

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'infrastructure',
      code: 'auth.provider_failed',
      message: 'The authentication provider failed.',
    });
  });

  it('fails closed when the limiter cannot count', async () => {
    const { signUp, authenticator } = build({ rateLimiter: createBrokenRateLimiter() });

    const result = await signUp.execute(MARA);

    expect(result.isErr() && result.error.kind).toBe('infrastructure');
    expect(authenticator.calls).toEqual([]);
  });
});
