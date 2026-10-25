'use client';

import { useState, useTransition } from 'react';
import type { SubmitEvent } from 'react';

import { useRouter } from '@i18n';

import { openParentAreaAction } from '../actions/open-parent-area-action';

import { useAuthErrorText } from './use-auth-error-text';

/** Passwords remain ephemeral and never leave the existing authentication path. */
export function useParentAccessForm() {
  const router = useRouter();
  const errorText = useAuthErrorText();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [password, setPassword] = useState('');
  return {
    password,
    setPassword,
    isPending,
    error: errorText(error),
    onSubmit: (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isPending) {
        return;
      }
      setError(undefined);
      startTransition(async () => {
        const result = await openParentAreaAction({ password });
        setPassword('');
        if (result.ok) {
          router.refresh();
        } else {
          setError(result.error.code);
        }
      });
    },
  };
}
