'use client';

import { useState, useTransition } from 'react';

import { useCountdown } from '@hooks/use-countdown';

import { requestPasswordResetAction } from '../actions/request-password-reset-action';

import { useAuthErrorText } from './use-auth-error-text';

/** The server limits requests too; the wait keeps an impatient person from running into that limit. */
const RESEND_WAIT_SECONDS = 60;

export interface ResendResetLinkState {
  readonly secondsLeft: number;
  readonly isPending: boolean;
  /** Why asking again failed, in words; `undefined` while it did not. */
  readonly error: string | undefined;
  /** The link was sent again and the person has not done anything since. */
  readonly hasResent: boolean;
  readonly resend: () => void;
}

/**
 * Asking for the reset link a second time, after a short wait. The answer is the same for every
 * address (nothing here can tell a registered address from another), and a refusal is shown in words.
 */
export function useResendResetLink(email: string): ResendResetLinkState {
  const errorText = useAuthErrorText();
  const { secondsLeft, restart } = useCountdown(RESEND_WAIT_SECONDS);
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [hasResent, setHasResent] = useState(false);

  return {
    secondsLeft,
    isPending,
    error: errorText(errorCode),
    hasResent,
    resend: () => {
      setErrorCode(undefined);
      setHasResent(false);
      startTransition(async () => {
        const result = await requestPasswordResetAction({ email });
        if (result.ok) {
          setHasResent(true);
          restart();
          return;
        }
        setErrorCode(result.error.code);
      });
    },
  };
}
