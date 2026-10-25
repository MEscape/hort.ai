'use client';

import { useState, useTransition } from 'react';

import { VOICE_NOTICE_VERSION } from '../../application/contracts/learner-constraints';
import { setVoiceConsentAction } from '../actions/set-voice-consent-action';
import { REQUEST_FAILED_CODE } from '../messages/message-keys';

import { useLearnerErrorText } from './use-learner-error-text';

export interface VoiceConsentState {
  readonly allowed: boolean;
  readonly isPending: boolean;
  readonly error: string | undefined;
  readonly change: (allowed: boolean) => void;
}

/**
 * The parent's speech-to-text switch. The switch shows what the server stored, never a guess: it
 * moves only once the server answered, and a failure leaves it where it was and says so.
 */
export function useVoiceConsent(profileId: string, initiallyAllowed: boolean): VoiceConsentState {
  const errorText = useLearnerErrorText();
  const [isPending, startTransition] = useTransition();
  const [allowed, setAllowed] = useState(initiallyAllowed);
  const [errorCode, setErrorCode] = useState<string>();

  return {
    allowed,
    isPending,
    error: errorText(errorCode),
    change: (next) => {
      if (isPending) {
        return;
      }
      setErrorCode(undefined);
      startTransition(async () => {
        const result = await setVoiceConsentAction({
          profileId,
          allowed: next,
          noticeVersion: next ? VOICE_NOTICE_VERSION : null,
        }).catch(() => null);
        if (result === null) {
          setErrorCode(REQUEST_FAILED_CODE);
        } else if (result.ok) {
          setAllowed(result.data.voiceConsent);
        } else {
          setErrorCode(result.error.code);
        }
      });
    },
  };
}
