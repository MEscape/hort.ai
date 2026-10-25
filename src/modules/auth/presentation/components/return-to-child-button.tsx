'use client';

import { useState, useTransition } from 'react';

import { Button } from '@components/ui/button';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { closeParentAreaAction } from '../actions/close-parent-area-action';
import { useAuthErrorText } from '../hooks/use-auth-error-text';
import { authRoutes } from '../routes';

/** Close the parent permission before returning to Home. A failed close is never reported as done. */
export function ReturnToChildButton() {
  const t = useTranslations('auth');
  const router = useRouter();
  const errorText = useAuthErrorText();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await closeParentAreaAction();
            if (result.ok) {
              router.push(authRoutes.childHome());
            } else {
              setError(result.error.code);
            }
          });
        }}
      >
        {t('parentAccess.back')}
      </Button>
      {error && <p role="alert">{errorText(error)}</p>}
    </div>
  );
}
