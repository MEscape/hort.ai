import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { signInAction } from '@modules/auth/presentation/actions/sign-in-action';
import { SignInForm } from '@modules/auth/presentation/components/sign-in-form';

import type * as I18n from '@i18n';

import { renderAuth } from './render-auth';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('@i18n', async (original) => ({
  ...(await original<typeof I18n>()),
  useRouter: () => ({ push }),
}));
vi.mock('@modules/auth/presentation/actions/sign-in-action', () => ({ signInAction: vi.fn() }));

describe('sign-in form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('focuses the first invalid field and never submits malformed input', async () => {
    renderAuth(<SignInForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Please enter your email address.')).toBeVisible();
    expect(screen.getByLabelText('Email address')).toHaveFocus();
    expect(signInAction).not.toHaveBeenCalled();
  });

  it('uses the server’s destination after success', async () => {
    vi.mocked(signInAction).mockResolvedValue({ ok: true, data: { redirectTo: '/home' } });
    renderAuth(<SignInForm returnTo="//untrusted.example" />);
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'alex@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), {
      target: { value: 'existing password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/home');
    });
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('');
    expect(signInAction).toHaveBeenCalledWith({
      email: 'alex@example.test',
      password: 'existing password',
      returnTo: '//untrusted.example',
    });
  });

  it('keeps the email, clears the refused password and shows translated feedback', async () => {
    vi.mocked(signInAction).mockResolvedValue({
      ok: false,
      error: { code: 'auth.invalid_credentials', message: 'Do not render this provider message' },
    });
    renderAuth(<SignInForm />);
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'alex@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), {
      target: { value: 'wrong password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check your email address and password',
    );
    expect(screen.getByLabelText('Email address')).toHaveValue('alex@example.test');
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('');
    expect(screen.queryByText('Do not render this provider message')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('toggles password visibility accessibly without submitting', () => {
    renderAuth(<SignInForm />);
    const toggle = screen.getByRole('button', { name: 'Show password' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'text');
    fireEvent.click(toggle);
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'password');
    expect(signInAction).not.toHaveBeenCalled();
  });
});
