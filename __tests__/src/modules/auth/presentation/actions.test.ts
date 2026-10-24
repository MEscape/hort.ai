import { revalidatePath } from 'next/cache';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  invalidCredentials,
  invalidToken,
  rateLimited,
} from '@modules/auth/domain/errors/auth-errors';
import { requestPasswordResetAction } from '@modules/auth/presentation/actions/request-password-reset-action';
import { resetPasswordAction } from '@modules/auth/presentation/actions/reset-password-action';
import { signInAction } from '@modules/auth/presentation/actions/sign-in-action';
import { signOutAction } from '@modules/auth/presentation/actions/sign-out-action';
import { signUpAction } from '@modules/auth/presentation/actions/sign-up-action';

import { errAsync, okAsync } from '@lib/result';

const commands = vi.hoisted(() => ({
  signIn: { execute: vi.fn() },
  signUp: { execute: vi.fn() },
  signOut: { execute: vi.fn() },
  requestPasswordReset: { execute: vi.fn() },
  resetPassword: { execute: vi.fn() },
}));
vi.mock('@modules/auth/composition', () => ({ getAuthCommands: () => commands }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

describe('authentication Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses malformed input before reaching any use case', async () => {
    for (const action of [
      signInAction,
      signUpAction,
      requestPasswordResetAction,
      resetPasswordAction,
    ]) {
      const result = await action({ email: 'invalid', password: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.fieldErrors).toBeDefined();
      }
    }
    for (const command of Object.values(commands)) {
      expect(command.execute).not.toHaveBeenCalled();
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('only returns a safe destination after successful sign-in', async () => {
    commands.signIn.execute.mockReturnValue(okAsync(undefined));
    expect(
      await signInAction({
        email: ' alex@example.test ',
        password: ' password ',
        returnTo: '//evil.test',
        tenantId: 'evil',
      }),
    ).toEqual({ ok: true, data: { redirectTo: '/home' } });
    expect(commands.signIn.execute).toHaveBeenCalledWith({
      email: 'alex@example.test',
      password: ' password ',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('does not refresh authenticated pages after rejected credentials', async () => {
    commands.signIn.execute.mockReturnValue(errAsync(invalidCredentials()));
    expect(await signInAction({ email: 'alex@example.test', password: 'wrong' })).toEqual({
      ok: false,
      error: { code: 'auth.invalid_credentials', message: expect.any(String) },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('passes only the validated parent identity to registration', async () => {
    commands.signUp.execute.mockReturnValue(okAsync(undefined));
    const password = 'otter lantern velvet mountain';
    expect(
      await signUpAction({
        name: ' Alex ',
        email: 'alex@example.test',
        password,
        confirmPassword: password,
        tenantId: 'other',
        role: 'admin',
      }),
    ).toEqual({ ok: true, data: undefined });
    expect(commands.signUp.execute).toHaveBeenCalledWith({
      name: 'Alex',
      email: 'alex@example.test',
      password,
    });
  });

  it('preserves retry information on a rate-limited recovery request', async () => {
    commands.requestPasswordReset.execute.mockReturnValue(errAsync(rateLimited(35)));
    const result = await requestPasswordResetAction({ email: 'alex@example.test' });
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'auth.rate_limited', retryAfterSeconds: 35 },
    });
  });

  it('does not turn an invalid reset token into success', async () => {
    commands.resetPassword.execute.mockReturnValue(errAsync(invalidToken()));
    expect(
      await resetPasswordAction({ token: 'expired', newPassword: 'otter lantern velvet mountain' }),
    ).toMatchObject({ ok: false, error: { code: 'auth.invalid_token' } });
  });

  it('invalidates protected pages only after logout succeeded', async () => {
    commands.signOut.execute.mockReturnValue(okAsync(undefined));
    expect(await signOutAction()).toEqual({ ok: true, data: undefined });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });
});
