'use client';

import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { resetOnboardingAction } from '../actions/reset-onboarding-action';
import { REQUEST_FAILED_CODE } from '../messages/message-keys';
import { learnerRoutes } from '../routes';

import { useLearnerErrorText } from './use-learner-error-text';

export interface ResetOnboardingState {
  readonly isPending: boolean;
  readonly error: string | undefined;
  readonly reset: () => void;
}

/**
 * Starts the setup over (development only): asks the server to delete the parent's profiles, then
 * opens the onboarding. A failure stays on the page and says so, so it can be tried again.
 */
export function useResetOnboarding(): ResetOnboardingState {
  const router = useRouter();
  const errorText = useLearnerErrorText();
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<string>();

  return {
    isPending,
    error: errorText(errorCode),
    reset: () => {
      if (isPending) {
        return;
      }
      setErrorCode(undefined);
      startTransition(async () => {
        const result = await resetOnboardingAction().catch(() => null);
        if (result === null) {
          setErrorCode(REQUEST_FAILED_CODE);
        } else if (result.ok) {
          router.replace(learnerRoutes.onboarding());
        } else {
          setErrorCode(result.error.code);
        }
      });
    },
  };
}
