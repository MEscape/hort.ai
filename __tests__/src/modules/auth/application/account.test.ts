import { describe, expect, it, vi } from 'vitest';

import type { AccountDependencies } from '@modules/auth/application/auth-dependencies';
import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import { ChangePassword } from '@modules/auth/application/commands/change-password';
import { UpdateDisplayName } from '@modules/auth/application/commands/update-display-name';
import { GetAccount } from '@modules/auth/application/queries/get-account';
import { invalidCredentials } from '@modules/auth/domain/errors/auth-errors';
import type { Actor } from '@modules/auth/domain/models/actor';
import type { AccountManager } from '@modules/auth/domain/ports/account-manager.port';
import { BetterAuthAccountManager } from '@modules/auth/infrastructure/better-auth/better-auth-account-manager';
import type { AccountApi } from '@modules/auth/infrastructure/better-auth/better-auth-account-manager';

import { errAsync, okAsync } from '@lib/result';

import { createTestRateLimiter } from '../../../support/rate-limiting';
import { failingWith, parent, recordingAudit, signedInAs } from '../fakes';

const TEACHER = parent({ roles: ['teacher'] });
const STRONG = 'ein-langes-sicheres-Passwort';

function setup(actor: Actor | null, accounts: Partial<AccountManager> = {}) {
  const audit = recordingAudit();
  const manager: AccountManager = {
    currentProfile: vi.fn(() => okAsync({ name: 'Frau Becker', email: 'becker@example.test' })),
    updateDisplayName: vi.fn(() => okAsync(undefined)),
    changePassword: vi.fn(() => okAsync(undefined)),
    ...accounts,
  };
  const deps: AccountDependencies = {
    authorization: createAuthorizationService({
      currentActor:
        actor === null
          ? failingWith({ kind: 'unauthorized', code: 'auth.unauthenticated', message: '' })
          : signedInAs(actor),
      audit: recordingAudit(),
    }),
    accounts: manager,
    rateLimiter: createTestRateLimiter(),
    audit,
  };
  return {
    manager,
    audit,
    getAccount: new GetAccount(deps),
    rename: new UpdateDisplayName(deps),
    changePassword: new ChangePassword(deps),
  };
}

describe('account settings use cases', () => {
  it('shows the signed-in teacher their own name, address and role, and nothing else', async () => {
    const { getAccount } = setup(TEACHER);
    expect((await getAccount.execute())._unsafeUnwrap()).toEqual({
      name: 'Frau Becker',
      email: 'becker@example.test',
      role: 'teacher',
    });
  });

  it('refuses every account operation without a session', async () => {
    const w = setup(null);
    expect((await w.getAccount.execute()).isErr()).toBe(true);
    expect((await w.rename.execute({ name: 'X' })).isErr()).toBe(true);
    expect(
      (await w.changePassword.execute({ currentPassword: 'a', newPassword: STRONG })).isErr(),
    ).toBe(true);
    expect(w.manager.updateDisplayName).not.toHaveBeenCalled();
    expect(w.manager.changePassword).not.toHaveBeenCalled();
  });

  it('renames with the trimmed name only and audits without the name', async () => {
    const w = setup(parent());
    expect((await w.rename.execute({ name: '  Sabine  ' })).isOk()).toBe(true);
    expect(w.manager.updateDisplayName).toHaveBeenCalledWith('Sabine');
    expect(w.audit.events).toEqual([
      { type: 'account.display_name_changed', actorId: parent().id, tenantId: parent().tenantId },
    ]);
    const empty = await w.rename.execute({ name: '   ' });
    expect(empty._unsafeUnwrapErr().code).toBe('auth.validation_failed');
  });

  it('enforces the new-password policy before asking the provider', async () => {
    const w = setup(parent());
    const short = await w.changePassword.execute({ currentPassword: 'old', newPassword: 'kurz' });
    expect(short._unsafeUnwrapErr()).toMatchObject({
      code: 'auth.validation_failed',
      fieldErrors: { newPassword: ['auth.validation.password_too_short'] },
    });
    expect(w.manager.changePassword).not.toHaveBeenCalled();
  });

  it('passes a wrong current password through as invalid credentials and records nothing', async () => {
    const w = setup(parent(), { changePassword: () => errAsync(invalidCredentials()) });
    const result = await w.changePassword.execute({
      currentPassword: 'wrong',
      newPassword: STRONG,
    });
    expect(result._unsafeUnwrapErr().code).toBe('auth.invalid_credentials');
    expect(w.audit.events).toEqual([]);
  });

  it('stops guessing the current password after five attempts an hour', async () => {
    const w = setup(parent(), { changePassword: () => errAsync(invalidCredentials()) });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await w.changePassword.execute({ currentPassword: 'wrong', newPassword: STRONG });
    }
    const sixth = await w.changePassword.execute({ currentPassword: 'wrong', newPassword: STRONG });
    expect(sixth._unsafeUnwrapErr().code).toBe('auth.rate_limited');
  });

  it('changes the password and audits it', async () => {
    const w = setup(TEACHER);
    expect(
      (await w.changePassword.execute({ currentPassword: 'old', newPassword: STRONG })).isOk(),
    ).toBe(true);
    expect(w.audit.events.map(({ type }) => type)).toEqual(['account.password_changed']);
  });
});

describe('BetterAuthAccountManager', () => {
  const headers = new Headers();
  function manager(api: Partial<AccountApi>) {
    return new BetterAuthAccountManager({
      api: {
        getSession: () => Promise.resolve(null),
        updateUser: () => Promise.resolve({}),
        changePassword: () => Promise.resolve({}),
        ...api,
      },
      getHeaders: () => Promise.resolve(headers),
    });
  }

  it('sends the name alone to the provider, so the role can never travel with it', async () => {
    const updateUser = vi.fn(() => Promise.resolve({}));
    await manager({ updateUser }).updateDisplayName('Sabine');
    expect(updateUser).toHaveBeenCalledWith({ body: { name: 'Sabine' }, headers });
  });

  it('revokes the other sessions with every password change', async () => {
    const changePassword = vi.fn(() => Promise.resolve({}));
    await manager({ changePassword }).changePassword({ currentPassword: 'a', newPassword: 'b' });
    expect(changePassword).toHaveBeenCalledWith({
      body: { currentPassword: 'a', newPassword: 'b', revokeOtherSessions: true },
      headers,
    });
  });

  it('reads the profile from the session and treats no session as not signed in', async () => {
    const signedIn = manager({
      getSession: () => Promise.resolve({ user: { name: 'Sabine', email: 's@example.test' } }),
    });
    expect((await signedIn.currentProfile())._unsafeUnwrap()).toEqual({
      name: 'Sabine',
      email: 's@example.test',
    });
    expect((await manager({}).currentProfile())._unsafeUnwrapErr().code).toBe(
      'auth.unauthenticated',
    );
  });
});
