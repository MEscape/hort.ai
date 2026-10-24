import { describe, expect, it } from 'vitest';

import type { AuthenticationDependencies } from '@modules/auth/application/auth-dependencies';
import { SignIn } from '@modules/auth/application/commands/sign-in';
import { AUTH_RATE_LIMITS } from '@modules/auth/application/rate-limits';
import { invalidCredentials } from '@modules/auth/domain/errors/auth-errors';

import { createBrokenRateLimiter, createTestRateLimiter } from '../../../support/rate-limiting';
import { fakeAuthenticator, clientAt, recordingAudit, UNRESOLVED_CLIENT } from '../fakes';

const PASSWORD = 'a-correct-password';

function build(overrides: Partial<AuthenticationDependencies> = {}) {
  const authenticator = fakeAuthenticator();
  const deps: AuthenticationDependencies = {
    authenticator,
    rateLimiter: createTestRateLimiter(),
    clientAddress: clientAt('203.0.113.7'),
    audit: recordingAudit(),
    ...overrides,
  };
  return { signIn: new SignIn(deps), authenticator, deps };
}

describe('SignIn', () => {
  it('asks the provider once, with the address normalised and the password untouched', async () => {
    const { signIn, authenticator } = build();

    const result = await signIn.execute({ email: ' Mara@Example.ORG ', password: PASSWORD });

    expect(result.isOk()).toBe(true);
    expect(authenticator.calls).toEqual([
      { flow: 'signIn', input: { email: 'mara@example.org', password: PASSWORD } },
    ]);
  });

  it('returns nothing that could be a credential or a session', async () => {
    const { signIn } = build();

    const result = await signIn.execute({ email: 'mara@example.org', password: PASSWORD });

    expect(result.isOk() && result.value).toBeUndefined();
  });

  it('rejects malformed input without reaching the provider', async () => {
    const { signIn, authenticator } = build();

    const result = await signIn.execute({ email: 'not-an-email', password: '' });

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'validation',
      fieldErrors: {
        email: ['auth.validation.email_invalid'],
        password: ['auth.validation.password_required'],
      },
    });
    expect(authenticator.calls).toEqual([]);
  });

  it('does not spend a budget on input that never reached the provider', async () => {
    const { signIn, authenticator } = build();
    for (let attempt = 0; attempt < AUTH_RATE_LIMITS.signIn.limit + 5; attempt += 1) {
      await signIn.execute({ email: 'mara@example.org', password: '' });
    }

    const result = await signIn.execute({ email: 'mara@example.org', password: PASSWORD });

    expect(result.isOk()).toBe(true);
    expect(authenticator.calls).toHaveLength(1);
  });

  it('passes a refusal by the provider on as the one invalid-credentials outcome', async () => {
    const authenticator = fakeAuthenticator(invalidCredentials());
    const { signIn } = build({ authenticator });

    const result = await signIn.execute({ email: 'mara@example.org', password: PASSWORD });

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'unauthorized',
      code: 'auth.invalid_credentials',
    });
    expect(JSON.stringify(result.isErr() && result.error)).not.toContain(PASSWORD);
  });

  it('stops asking the provider once an account has used its budget', async () => {
    const { signIn, authenticator } = build();
    const attempts = AUTH_RATE_LIMITS.signIn.limit;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await signIn.execute({ email: 'mara@example.org', password: PASSWORD });
    }

    const result = await signIn.execute({ email: 'mara@example.org', password: PASSWORD });

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'rate_limited',
      code: 'auth.rate_limited',
    });
    expect(
      result.isErr() && result.error.kind === 'rate_limited' && result.error.retryAfterSeconds,
    ).toBeGreaterThan(0);
    expect(authenticator.calls).toHaveLength(attempts);
  });

  it('counts one account whatever the letter case of the address, and others separately', async () => {
    const { signIn, authenticator } = build();
    for (let attempt = 0; attempt < AUTH_RATE_LIMITS.signIn.limit; attempt += 1) {
      await signIn.execute({
        email: attempt % 2 === 0 ? 'MARA@example.org' : 'mara@example.org',
        password: PASSWORD,
      });
    }

    const sameAccount = await signIn.execute({ email: 'Mara@Example.org', password: PASSWORD });
    const otherAccount = await signIn.execute({ email: 'lena@example.org', password: PASSWORD });

    expect(sameAccount.isErr() && sameAccount.error.kind).toBe('rate_limited');
    expect(otherAccount.isOk()).toBe(true);
    expect(authenticator.calls).toHaveLength(AUTH_RATE_LIMITS.signIn.limit + 1);
  });

  it('limits one client address across many accounts, without punishing another address', async () => {
    const rateLimiter = createTestRateLimiter();
    const noisy = build({ rateLimiter, clientAddress: clientAt('198.51.100.9') });
    const calm = build({ rateLimiter, clientAddress: clientAt('198.51.100.10') });
    for (let attempt = 0; attempt < AUTH_RATE_LIMITS.signInClient.limit; attempt += 1) {
      await noisy.signIn.execute({ email: `parent-${attempt}@example.org`, password: PASSWORD });
    }

    const refused = await noisy.signIn.execute({
      email: 'one-more@example.org',
      password: PASSWORD,
    });
    const allowed = await calm.signIn.execute({ email: 'calm@example.org', password: PASSWORD });

    expect(refused.isErr() && refused.error.kind).toBe('rate_limited');
    expect(allowed.isOk()).toBe(true);
  });

  it('still limits the account when the client address cannot be resolved', async () => {
    const { signIn, authenticator } = build({ clientAddress: UNRESOLVED_CLIENT });
    for (let attempt = 0; attempt < AUTH_RATE_LIMITS.signIn.limit; attempt += 1) {
      await signIn.execute({ email: 'mara@example.org', password: PASSWORD });
    }

    const result = await signIn.execute({ email: 'mara@example.org', password: PASSWORD });

    expect(result.isErr() && result.error.kind).toBe('rate_limited');
    expect(authenticator.calls).toHaveLength(AUTH_RATE_LIMITS.signIn.limit);
  });

  it('fails closed when the limiter cannot count: no attempt reaches the provider', async () => {
    const { signIn, authenticator } = build({ rateLimiter: createBrokenRateLimiter() });

    const result = await signIn.execute({ email: 'mara@example.org', password: PASSWORD });

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'infrastructure',
      code: 'auth.rate_limiter_failed',
    });
    expect(authenticator.calls).toEqual([]);
  });
});
