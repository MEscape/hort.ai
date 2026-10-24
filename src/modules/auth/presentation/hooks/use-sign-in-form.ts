'use client';

import { useState, useTransition } from 'react';
import type { BaseSyntheticEvent } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import type { HortMood } from '@components/brand/hort';

import { useRouter } from '@i18n';

import { applyActionError } from '@lib/actions';

import { signInAction } from '../actions/sign-in-action';
import { hortMoodOf } from '../forms/hort-mood';
import { signInSchema } from '../schemas/sign-in-schema';

import { useAuthErrorText } from './use-auth-error-text';

import type { SignIn } from '../schemas/sign-in-schema';
import type { UseFormReturn } from 'react-hook-form';

export interface SignInFormState {
  readonly form: UseFormReturn<SignIn>;
  readonly errorText: (code: string | undefined) => string | undefined;
  /** Why the whole form was refused, in words; `undefined` while it was not. */
  readonly formError: string | undefined;
  /** What is in the email field now (it decides when to offer "did you mean"). */
  readonly email: string;
  readonly isPending: boolean;
  readonly mood: HortMood;
  readonly onSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
}

/**
 * The state of the sign-in form: validation by the module schema, the Server Action, pending state,
 * and where the person ends up. A rejected password is cleared but the address stays, so only
 * what is wrong has to be typed again.
 */
// @unsaved-work none Credential entry is intentionally ephemeral; never preserve or draft a password.
export function useSignInForm(returnTo: string | undefined): SignInFormState {
  const router = useRouter();
  const errorText = useAuthErrorText();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  // A field is checked when it is left and again on every key after that: errors appear before submitting.
  const form = useForm<SignIn>({
    resolver: zodResolver(signInSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });
  const email = useWatch({ control: form.control, name: 'email' });
  const formError = errorText(formErrorCode ?? undefined);

  const onSubmit = form.handleSubmit((values) => {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await signInAction({ ...values, returnTo });
      if (result.ok) {
        // The action revalidated the layout, so the destination is fetched fresh: no extra refresh.
        router.push(result.data.redirectTo);
        return;
      }
      form.resetField('password');
      setFormErrorCode(applyActionError(result.error, form.setError));
      form.setFocus('password');
    });
  });

  return {
    form,
    errorText,
    formError,
    email,
    isPending,
    mood: hortMoodOf({ isPending, hasError: formError !== undefined }),
    onSubmit,
  };
}
