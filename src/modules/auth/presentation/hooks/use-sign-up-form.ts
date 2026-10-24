'use client';

import { useState, useTransition } from 'react';
import type { BaseSyntheticEvent } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import type { HortMood } from '@components/brand/hort';

import { applyActionError } from '@lib/actions';

import { signUpAction } from '../actions/sign-up-action';
import { hortMoodOf } from '../forms/hort-mood';
import { assessPassword, STRENGTH } from '../password/password-strength';
import { signUpSchema } from '../schemas/sign-up-schema';

import { useAuthErrorText } from './use-auth-error-text';

import type { PasswordAssessment } from '../password/password-strength';
import type { SignUp } from '../schemas/sign-up-schema';
import type { UseFormReturn } from 'react-hook-form';

export interface SignUpFormState {
  readonly form: UseFormReturn<SignUp>;
  readonly errorText: (code: string | undefined) => string | undefined;
  readonly formError: string | undefined;
  /** The values the page needs while they are typed: the field's guidance and the "did you mean". */
  readonly watched: {
    readonly name: string;
    readonly email: string;
    readonly password: string;
    readonly confirmPassword: string;
  };
  readonly assessment: PasswordAssessment;
  /** The address the confirmation link went to; `null` until the account was created. */
  readonly sentTo: string | null;
  readonly isPending: boolean;
  readonly mood: HortMood;
  readonly onSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
}

/**
 * The state of the sign-up form. The password is judged as it is typed (advice, never a rule: only
 * the length is enforced), and Hort cheers once it is good. After the server accepted the request
 * the form is emptied, because the password is not kept around once it has been sent.
 */
// @unsaved-work none One-step parent registration holds credentials, not a persistent draft.
export function useSignUpForm(): SignUpFormState {
  const errorText = useAuthErrorText();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<SignUp>({
    resolver: zodResolver(signUpSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });
  const [name, email, password, confirmPassword] = useWatch({
    control: form.control,
    name: ['name', 'email', 'password', 'confirmPassword'],
  });
  const assessment = assessPassword(password, [name, email]);
  const formError = errorText(formErrorCode ?? undefined);

  const onSubmit = form.handleSubmit((values) => {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await signUpAction(values);
      if (result.ok) {
        setSentTo(values.email.trim());
        form.reset();
        return;
      }
      form.resetField('password');
      form.resetField('confirmPassword');
      setFormErrorCode(applyActionError(result.error, form.setError));
    });
  });

  return {
    form,
    errorText,
    formError,
    watched: { name, email, password, confirmPassword },
    assessment,
    sentTo,
    isPending,
    mood: hortMoodOf({
      isPending,
      hasError: formError !== undefined,
      isCheering: assessment.level >= STRENGTH.good,
    }),
    onSubmit,
  };
}
