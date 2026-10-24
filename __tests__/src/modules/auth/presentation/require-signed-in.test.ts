import { beforeEach, describe, expect, it, vi } from 'vitest';

import { providerFailed, unauthenticated } from '@modules/auth/domain/errors/auth-errors';
import { requireSignedIn } from '@modules/auth/presentation/guards/require-signed-in';

import { redirect } from '@i18n';

import { errAsync, okAsync } from '@lib/result';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('@modules/auth/composition', () => ({
  getAuthQueries: () => ({ getCurrentActor: { execute } }),
}));
vi.mock('@i18n', () => ({
  redirect: vi.fn(() => {
    throw new Error('redirect');
  }),
}));
vi.mock('@i18n/server', () => ({ getLocale: () => Promise.resolve('de') }));

describe('signed-in page guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the server’s actor', async () => {
    const actor = { id: 'parent-1', tenantId: 'default', roles: ['parent'] };
    execute.mockReturnValue(okAsync(actor));
    expect(await requireSignedIn('/home')).toEqual(actor);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends a signed-out parent to localized sign-in, preserving the destination', async () => {
    execute.mockReturnValue(errAsync(unauthenticated()));
    await expect(requireSignedIn('/home')).rejects.toThrow('redirect');
    expect(redirect).toHaveBeenCalledWith({ href: '/sign-in?returnTo=%2Fhome', locale: 'de' });
  });

  it('sends infrastructure failures to the error boundary rather than a sign-in loop', async () => {
    execute.mockReturnValue(errAsync(providerFailed(new Error('offline'))));
    await expect(requireSignedIn('/home')).rejects.toThrow('auth.provider_failed');
    expect(redirect).not.toHaveBeenCalled();
  });
});
