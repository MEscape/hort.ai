'use client';

import { useState, useTransition } from 'react';
import type { BaseSyntheticEvent } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import type { HortMood } from '@components/brand/hort';
import { hortMoodOf } from '@components/brand/hort-mood';

import { applyActionError } from '@lib/actions';

import { resetPasswordAction } from '../actions/reset-password-action';
import { assessPassword, STRENGTH } from '../password/password-strength';
import { resetPasswordFormSchema } from '../schemas/reset-password-schema';

import { useAuthErrorText } from './use-auth-error-text';

import type { PasswordAssessment } from '../password/password-strength';
import type { ResetPasswordForm } from '../schemas/reset-password-schema';
import type { UseFormReturn } from 'react-hook-form';

export interface ResetPasswordFormState {
  readonly form: UseFormReturn<ResetPasswordForm>;
  readonly errorText: (code: string | undefined) => string | undefined;
  readonly formError: string | undefined;
  readonly watched: { readonly newPassword: string; readonly confirmPassword: string };
  readonly assessment: PasswordAssessment;
  /** True once the server saved the new password. */
  readonly isDone: boolean;
  readonly isPending: boolean;
  readonly mood: HortMood;
  readonly onSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
}

/** The state of the "choose a new password" form. The token comes from the emailed link, not from the person. */
// @unsaved-work none New credentials are intentionally ephemeral; never preserve a password draft.
export function useResetPasswordForm(token: string): ResetPasswordFormState {
  const errorText = useAuthErrorText();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordFormSchema),
    mode: 'onTouched',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const [newPassword, confirmPassword] = useWatch({
    control: form.control,
    name: ['newPassword', 'confirmPassword'],
  });
  const assessment = assessPassword(newPassword);
  const formError = errorText(formErrorCode ?? undefined);

  const onSubmit = form.handleSubmit((values) => {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await resetPasswordAction({ token, newPassword: values.newPassword });
      if (result.ok) {
        form.reset();
        setIsDone(true);
        return;
      }
      setFormErrorCode(applyActionError(result.error, form.setError));
    });
  });

  return {
    form,
    errorText,
    formError,
    watched: { newPassword, confirmPassword },
    assessment,
    isDone,
    isPending,
    mood: hortMoodOf({
      isPending,
      hasError: formError !== undefined,
      isCheering: assessment.level >= STRENGTH.good,
    }),
    onSubmit,
  };
}
