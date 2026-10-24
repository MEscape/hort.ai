'use client';

import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { signOutAction } from '../actions/sign-out-action';
import { authRoutes } from '../routes';

import { useAuthErrorText } from './use-auth-error-text';

export function useSignOut() {
  const router = useRouter();
  const errorText = useAuthErrorText();
  const [errorCode, setErrorCode] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return {
    isPending,
    error: errorText(errorCode),
    signOut: () => {
      if (isPending) {
        return;
      }
      setErrorCode(undefined);
      startTransition(async () => {
        const result = await signOutAction();
        if (result.ok) {
          router.replace(authRoutes.signIn());
          return;
        }
        setErrorCode(result.error.code);
      });
    },
  };
}
