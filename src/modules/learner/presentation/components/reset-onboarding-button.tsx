'use client';

import { useId } from 'react';

import { FormAlert } from '@components/shared/form-alert';
import { Button } from '@components/ui/button';
import { RotateCcw, Spinner } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useResetOnboarding } from '../hooks/use-reset-onboarding';

/**
 * A development helper on the parent's home: deletes the parent's child profiles and opens the setup
 * again. The page shows it only outside production, and the use case refuses in production anyway.
 */
export function ResetOnboardingButton() {
  const t = useTranslations('learner');
  const id = useId();
  const { isPending, error, reset } = useResetOnboarding();

  return (
    <div className="flex flex-col gap-3 rounded-token-lg border-2 border-dashed border-border-strong p-4">
      <p className="text-sm text-copy-muted">{t('reset.hint')}</p>
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        aria-busy={isPending}
        onClick={reset}
      >
        {isPending ? (
          <Spinner className="animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw aria-hidden="true" />
        )}
        {isPending ? t('reset.pending') : t('reset.label')}
      </Button>
      <FormAlert id={`${id}-error`} message={error} />
    </div>
  );
}
