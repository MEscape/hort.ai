'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { applyActionError } from '@lib/actions';

import { AUTH_ERROR_CODES } from '../../application/contracts/auth-constraints';
import { changePasswordAction } from '../actions/change-password-action';
import { assessPassword } from '../password/password-strength';
import { passwordChangeFormSchema } from '../schemas/account-schema';

import { useAuthErrorText } from './use-auth-error-text';

import type { PasswordChangeForm } from '../schemas/account-schema';

const EMPTY: PasswordChangeForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

/**
 * Changing the signed-in person's password. A wrong current password lands on its own field; after
 * a change the fields are emptied, because no password is kept around once sent.
 */
// @unsaved-work none Credentials are intentionally ephemeral; never preserve a password draft.
export function usePasswordChangeForm() {
  const errorText = useAuthErrorText();
  const [isPending, startTransition] = useTransition();
  const [isChanged, setIsChanged] = useState(false);
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const form = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeFormSchema),
    defaultValues: EMPTY,
    mode: 'onTouched',
  });
  const [newPassword, confirmPassword] = useWatch({
    control: form.control,
    name: ['newPassword', 'confirmPassword'],
  });

  const onSubmit = form.handleSubmit(({ currentPassword, newPassword: next }) => {
    setIsChanged(false);
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await changePasswordAction({ currentPassword, newPassword: next });
      if (result.ok) {
        form.reset(EMPTY);
        setIsChanged(true);
        return;
      }
      setFormErrorCode(
        applyActionError(result.error, form.setError, {
          [AUTH_ERROR_CODES.invalidCredentials]: 'currentPassword',
        }),
      );
    });
  });

  return {
    form,
    isPending,
    isChanged,
    errorText,
    formError: errorText(formErrorCode ?? undefined),
    watched: { newPassword, confirmPassword },
    assessment: assessPassword(newPassword),
    onSubmit,
  };
}
