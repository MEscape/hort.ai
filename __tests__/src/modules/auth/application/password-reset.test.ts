import { describe, expect, it } from 'vitest';

import type { AuthenticationDependencies } from '@modules/auth/application/auth-dependencies';
import { AdmitLinkRequest } from '@modules/auth/application/commands/admit-link-request';
import { RequestPasswordReset } from '@modules/auth/application/commands/request-password-reset';
import { ResetPassword } from '@modules/auth/application/commands/reset-password';
import { AUTH_RATE_LIMITS } from '@modules/auth/application/rate-limits';
import { invalidToken } from '@modules/auth/domain/errors/auth-errors';

import { createBrokenRateLimiter, createTestRateLimiter } from '../../../support/rate-limiting';
import { UNRESOLVED_CLIENT, clientAt, fakeAuthenticator, recordingAudit } from '../fakes';

const NEW_PASSWORD = 'a-brand-new-password';

function build(overrides: Partial<AuthenticationDependencies> = {}) {
  const authenticator = fakeAuthenticator();
  const deps: AuthenticationDependencies = {
    authenticator,
    rateLimiter: createTestRateLimiter(),
    clientAddress: clientAt('203.0.113.7'),
    audit: recordingAudit(),
    ...overrides,
  };
  return {
    authenticator,
    request: new RequestPasswordReset(deps),
    reset: new ResetPassword(deps),
    admit: new AdmitLinkRequest(deps),
  };
}

describe('RequestPasswordReset', () => {
  it('asks the provider with a normalised address and answers with nothing', async () => {
    const { request, authenticator } = build();

    const result = await request.execute({ email: ' Mara@Example.ORG ' });

    expect(result.isOk() && result.value).toBeUndefined();
    expect(authenticator.calls).toEqual([
      { flow: 'requestPasswordReset', input: { email: 'mara@example.org' } },
    ]);
  });

  it('answers identically for any well-formed address: the use case adds no tell for known accounts', async () => {
    const known = build();
    const unknown = build();

    const a = await known.request.execute({ email: 'registered@example.org' });
    const b = await unknown.request.execute({ email: 'nobody@example.org' });

    expect(a).toEqual(b);
  });

  it('rejects a malformed address without reaching the provider', async () => {
    const { request, authenticator } = build();

    const result = await request.execute({ email: 'nope' });

    expect(result.isErr() && result.error.kind).toBe('validation');
    expect(authenticator.calls).toEqual([]);
  });

  it('limits mail to one address, so nobody can flood an inbox', async () => {
    const { request, authenticator } = build();
    for (let attempt = 0; attempt < AUTH_RATE_LIMITS.passwordResetRequest.limit; attempt += 1) {
      await request.execute({ email: 'mara@example.org' });
    }

    const result = await request.execute({ email: 'mara@example.org' });

    expect(result.isErr() && result.error.kind).toBe('rate_limited');
    expect(authenticator.calls).toHaveLength(AUTH_RATE_LIMITS.passwordResetRequest.limit);
  });

  it('fails closed when the limiter cannot count: no mail is sent', async () => {
    const { request, authenticator } = build({ rateLimiter: createBrokenRateLimiter() });

    const result = await request.execute({ email: 'mara@example.org' });

    expect(result.isErr() && result.error.kind).toBe('infrastructure');
    expect(authenticator.calls).toEqual([]);
  });
});

describe('ResetPassword', () => {
  it('hands the provider the token and the new password', async () => {
    const { reset, authenticator } = build();

    const result = await reset.execute({ token: 'token-from-the-link', newPassword: NEW_PASSWORD });

    expect(result.isOk()).toBe(true);
    expect(authenticator.calls).toEqual([
      {
        flow: 'resetPassword',
        input: { token: 'token-from-the-link', newPassword: NEW_PASSWORD },
      },
    ]);
  });

  it('refuses a new password below the minimum before the provider sees the token', async () => {
    const { reset, authenticator } = build();

    const result = await reset.execute({ token: 'token-from-the-link', newPassword: 'short' });

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'validation',
      fieldErrors: { newPassword: ['auth.validation.password_too_short'] },
    });
    expect(authenticator.calls).toEqual([]);
  });

  it('reports an invalid or expired token as one outcome', async () => {
    const authenticator = fakeAuthenticator(invalidToken());
    const { reset } = build({ authenticator });

    const result = await reset.execute({ token: 'expired', newPassword: NEW_PASSWORD });

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'unauthorized',
      code: 'auth.invalid_token',
    });
  });

  it('bounds how much work one client can ask for', async () => {
    const { reset, authenticator } = build();
    for (let attempt = 0; attempt < AUTH_RATE_LIMITS.passwordResetClient.limit; attempt += 1) {
      await reset.execute({ token: `token-${attempt}`, newPassword: NEW_PASSWORD });
    }

    const result = await reset.execute({ token: 'one-more', newPassword: NEW_PASSWORD });

    expect(result.isErr() && result.error.kind).toBe('rate_limited');
    expect(authenticator.calls).toHaveLength(AUTH_RATE_LIMITS.passwordResetClient.limit);
  });
});

describe('AdmitLinkRequest', () => {
  it('admits a client until its budget for opening emailed links is used', async () => {
    const { admit } = build();
    for (let attempt = 0; attempt < AUTH_RATE_LIMITS.linkClient.limit; attempt += 1) {
      expect((await admit.execute()).isOk()).toBe(true);
    }

    const result = await admit.execute();

    expect(result.isErr() && result.error.kind).toBe('rate_limited');
  });

  it('does not count an address it cannot resolve: the link token is the credential', async () => {
    const { admit } = build({ clientAddress: UNRESOLVED_CLIENT });
    for (let attempt = 0; attempt < AUTH_RATE_LIMITS.linkClient.limit + 5; attempt += 1) {
      expect((await admit.execute()).isOk()).toBe(true);
    }
  });

  it('fails closed when the limiter cannot count', async () => {
    const { admit } = build({ rateLimiter: createBrokenRateLimiter() });

    const result = await admit.execute();

    expect(result.isErr() && result.error.kind).toBe('infrastructure');
  });
});
