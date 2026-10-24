import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { signUpAction } from '@modules/auth/presentation/actions/sign-up-action';
import { SignUpForm } from '@modules/auth/presentation/components/sign-up-form';

import type { ActionResult } from '@lib/result';

import { renderAuth } from './render-auth';

vi.mock('@modules/auth/presentation/actions/sign-up-action', () => ({ signUpAction: vi.fn() }));

const PASSWORD = 'otter lantern velvet mountain';
function fillSignUp(confirmation = PASSWORD) {
  fireEvent.change(screen.getByLabelText('What should we call you?'), {
    target: { value: 'Alex' },
  });
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'alex@example.test' },
  });
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), {
    target: { value: PASSWORD },
  });
  fireEvent.change(screen.getByLabelText('Repeat password'), { target: { value: confirmation } });
}

describe('parent registration form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects mismatched passwords without creating an account', async () => {
    renderAuth(<SignUpForm />);
    fillSignUp('a different password');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('The two passwords are not the same yet.')).toBeVisible();
    expect(screen.getByLabelText('Repeat password')).toHaveFocus();
    expect(signUpAction).not.toHaveBeenCalled();
  });

  it('prevents another submission while pending and focuses the non-enumerating confirmation', async () => {
    let finish: (value: ActionResult<void>) => void = () => undefined;
    vi.mocked(signUpAction).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderAuth(<SignUpForm />);
    fillSignUp();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('button', { name: 'Creating your account…' })).toBeDisabled();
    expect(screen.getByLabelText('Email address')).toBeDisabled();
    finish({ ok: true, data: undefined });
    const heading = await screen.findByRole('heading', { name: 'Check your inbox!' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(screen.getByText(/If alex@example.test is new here/)).toBeVisible();
    expect(screen.queryByLabelText('Password', { exact: true })).not.toBeInTheDocument();
    expect(signUpAction).toHaveBeenCalledTimes(1);
  });

  it('offers an email correction without silently changing the address', async () => {
    renderAuth(<SignUpForm />);
    const email = screen.getByLabelText('Email address');
    fireEvent.change(email, { target: { value: 'alex@gmial.com' } });
    fireEvent.blur(email);
    const suggestion = await screen.findByRole('button', { name: 'alex@gmail.com' });
    expect(email).toHaveValue('alex@gmial.com');
    fireEvent.click(suggestion);
    await waitFor(() => {
      expect(email).toHaveValue('alex@gmail.com');
    });
  });
});
