import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requestPasswordResetAction } from '@modules/auth/presentation/actions/request-password-reset-action';
import { resetPasswordAction } from '@modules/auth/presentation/actions/reset-password-action';
import { signOutAction } from '@modules/auth/presentation/actions/sign-out-action';
import { EmailVerificationResult } from '@modules/auth/presentation/components/email-verification-result';
import { ForgotPasswordForm } from '@modules/auth/presentation/components/forgot-password-form';
import { ForgotPasswordSent } from '@modules/auth/presentation/components/forgot-password-sent';
import { ResetPasswordForm } from '@modules/auth/presentation/components/reset-password-form';
import { SignOutButton } from '@modules/auth/presentation/components/sign-out-button';

import type * as I18n from '@i18n';

import { renderAuth } from './render-auth';

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('@i18n', async (original) => ({
  ...(await original<typeof I18n>()),
  useRouter: () => ({ replace }),
}));
vi.mock('@modules/auth/presentation/actions/request-password-reset-action', () => ({
  requestPasswordResetAction: vi.fn(),
}));
vi.mock('@modules/auth/presentation/actions/reset-password-action', () => ({
  resetPasswordAction: vi.fn(),
}));
vi.mock('@modules/auth/presentation/actions/sign-out-action', () => ({ signOutAction: vi.fn() }));

describe('recovery and sign-out interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the same recovery answer for any accepted address and lets the parent correct it', async () => {
    vi.mocked(requestPasswordResetAction).mockResolvedValue({ ok: true, data: undefined });
    renderAuth(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'unknown@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send me the link' }));
    expect(await screen.findByRole('heading', { name: 'Check your inbox!' })).toBeVisible();
    expect(screen.getByText(/If there is an account/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send again in 60 s' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Use a different address' }));
    expect(screen.getByLabelText('Email address')).toHaveValue('unknown@example.test');
  });

  it('waits before resending and displays a translated resend failure', async () => {
    vi.useFakeTimers();
    vi.mocked(requestPasswordResetAction).mockResolvedValue({
      ok: false,
      error: { code: 'auth.rate_limited', message: 'raw provider text' },
    });
    renderAuth(<ForgotPasswordSent email="alex@example.test" onChangeAddress={() => undefined} />);
    for (let second = 0; second < 60; second += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send the link again' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Wait a moment');
    expect(screen.queryByText('raw provider text')).not.toBeInTheDocument();
    expect(screen.queryByText('We sent it again.')).not.toBeInTheDocument();
  });

  it('only reports a password change after the server accepted the token', async () => {
    vi.mocked(resetPasswordAction).mockResolvedValue({
      ok: false,
      error: { code: 'auth.invalid_token', message: 'raw' },
    });
    renderAuth(<ResetPasswordForm token="token-from-link" />);
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'a long random passphrase' },
    });
    fireEvent.change(screen.getByLabelText('Repeat new password'), {
      target: { value: 'a long random passphrase' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Save password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This link no longer works');
    expect(screen.queryByRole('heading', { name: 'All set!' })).not.toBeInTheDocument();
    vi.mocked(resetPasswordAction).mockResolvedValue({ ok: true, data: undefined });
    fireEvent.click(await screen.findByRole('button', { name: 'Save password' }));
    expect(await screen.findByRole('heading', { name: 'All set!' })).toBeVisible();
    expect(resetPasswordAction).toHaveBeenLastCalledWith({
      token: 'token-from-link',
      newPassword: 'a long random passphrase',
    });
  });

  it('shows verification failure with a way to request a new link by signing in', () => {
    renderAuth(<EmailVerificationResult hasFailed />);
    expect(screen.getByRole('heading', { name: 'That link did not work' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute(
      'href',
      '/en/sign-in',
    );
  });

  it('stays on the page if logout fails and only navigates after confirmation', async () => {
    vi.mocked(signOutAction).mockResolvedValue({
      ok: false,
      error: { code: 'auth.provider_failed', message: 'raw' },
    });
    renderAuth(<SignOutButton />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We cannot get through');
    expect(replace).not.toHaveBeenCalled();
    vi.mocked(signOutAction).mockResolvedValue({ ok: true, data: undefined });
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/sign-in');
    });
  });
});
