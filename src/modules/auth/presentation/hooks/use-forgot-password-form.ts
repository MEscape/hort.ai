'use client';

import { useState, useTransition } from 'react';
import type { BaseSyntheticEvent } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import type { LumiMood } from '@components/brand/lumi';

import { applyActionError } from '@lib/actions';

import { requestPasswordResetAction } from '../actions/request-password-reset-action';
import { lumiMoodOf } from '../forms/lumi-mood';
import { requestPasswordResetSchema } from '../schemas/request-password-reset-schema';

import { useAuthErrorText } from './use-auth-error-text';

import type { RequestPasswordReset } from '../schemas/request-password-reset-schema';
import type { UseFormReturn } from 'react-hook-form';

export interface ForgotPasswordFormState {
  readonly form: UseFormReturn<RequestPasswordReset>;
  readonly errorText: (code: string | undefined) => string | undefined;
  readonly formError: string | undefined;
  readonly email: string;
  /** Where the link went; `null` until the request was accepted. It is the same answer for every address. */
  readonly sentTo: string | null;
  /** Back to the form, to correct the address. */
  readonly changeAddress: () => void;
  readonly isPending: boolean;
  readonly mood: LumiMood;
  readonly onSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
}

/** The state of the "forgot your password" form: one field, one request, one answer. */
// @unsaved-work none One email address can be reentered; no persistent draft is edited.
export function useForgotPasswordForm(): ForgotPasswordFormState {
  const errorText = useAuthErrorText();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<RequestPasswordReset>({
    resolver: zodResolver(requestPasswordResetSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });
  const email = useWatch({ control: form.control, name: 'email' });
  const formError = errorText(formErrorCode ?? undefined);

  const onSubmit = form.handleSubmit((values) => {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction(values);
      if (result.ok) {
        setSentTo(values.email.trim());
        return;
      }
      setFormErrorCode(applyActionError(result.error, form.setError));
    });
  });

  return {
    form,
    errorText,
    formError,
    email,
    sentTo,
    changeAddress: () => {
      setSentTo(null);
    },
    isPending,
    mood: lumiMoodOf({ isPending, hasError: formError !== undefined }),
    onSubmit,
  };
}
