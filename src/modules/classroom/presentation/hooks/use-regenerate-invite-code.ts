'use client';

import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { regenerateInviteCodeAction } from '../actions/regenerate-invite-code-action';

/**
 * Replacing a class's code, only after the teacher confirmed it: the old code stops working at once
 * (children already in the class stay). The new code is kept here, so it shows even where codes are
 * stored as a hash only.
 */
export function useRegenerateInviteCode(classroomId: string) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    setErrorCode(null);
    startTransition(async () => {
      const result = await regenerateInviteCodeAction({ id: classroomId });
      if (!result.ok) {
        setErrorCode(result.error.code);
        return;
      }
      setNewCode(result.data.inviteCode);
      setIsConfirming(false);
      router.refresh();
    });
  }

  return {
    isConfirming,
    isPending,
    newCode,
    errorCode,
    confirm,
    request: () => {
      setErrorCode(null);
      setIsConfirming(true);
    },
    cancel: () => {
      setIsConfirming(false);
    },
  };
}
