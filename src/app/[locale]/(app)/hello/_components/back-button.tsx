'use client';

import { Button } from '@components/ui/button';
import { ArrowLeft } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

export interface BackButtonProps {
  readonly disabled: boolean;
  readonly onClick: () => void;
}

/** The way back: a small round button with an arrow, the same place on every step. */
export function BackButton({ disabled, onClick }: BackButtonProps) {
  const t = useTranslations('learner');
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={disabled}
      onClick={onClick}
      aria-label={t('childWelcome.actions.back')}
      className="size-12 rounded-full border-border bg-surface/90 shadow-soft"
    >
      <ArrowLeft className="size-6" aria-hidden="true" />
    </Button>
  );
}
