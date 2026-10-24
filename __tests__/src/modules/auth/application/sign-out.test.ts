import { describe, expect, it } from 'vitest';

import { SignOut } from '@modules/auth/application/commands/sign-out';
import { providerFailed } from '@modules/auth/domain/errors/auth-errors';
import type { AuthenticatorError } from '@modules/auth/domain/ports/authenticator.port';

import { createTestRateLimiter } from '../../../support/rate-limiting';
import { clientAt, fakeAuthenticator, recordingAudit } from '../fakes';

function build(outcome: AuthenticatorError | null = null) {
  const authenticator = fakeAuthenticator(outcome);
  const signOut = new SignOut({
    authenticator,
    rateLimiter: createTestRateLimiter(),
    clientAddress: clientAt('203.0.113.7'),
    audit: recordingAudit(),
  });
  return { signOut, authenticator };
}

describe('SignOut', () => {
  it('ends the session through the provider and returns nothing', async () => {
    const { signOut, authenticator } = build();

    const result = await signOut.execute();

    expect(result.isOk() && result.value).toBeUndefined();
    expect(authenticator.calls).toEqual([{ flow: 'signOut', input: undefined }]);
  });

  it('can be repeated: signing out twice is the same as once', async () => {
    const { signOut } = build();

    const first = await signOut.execute();
    const second = await signOut.execute();

    expect(first.isOk() && second.isOk()).toBe(true);
  });

  it('reports a provider failure instead of pretending the session ended', async () => {
    const { signOut } = build(providerFailed(new Error('down')));

    const result = await signOut.execute();

    expect(result.isErr() && result.error.code).toBe('auth.provider_failed');
  });
});
