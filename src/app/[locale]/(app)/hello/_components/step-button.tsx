'use client';

import { Button } from '@components/ui/button';
import { Spinner } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

export interface StepButtonProps {
  readonly label: string;
  /** True while the backend works: the button shows "saving" and a second tap cannot double-send. */
  readonly isPending: boolean;
  readonly onClick: () => void;
  readonly variant?: 'default' | 'accent';
  readonly className?: string;
}

/**
 * The one big button of a step: a pill as wide as the screen allows, always at the bottom. The
 * same shape and place on every step, so a child learns where "on" is.
 */
export function StepButton({
  label,
  isPending,
  onClick,
  variant = 'accent',
  className,
}: StepButtonProps) {
  const t = useTranslations('learner');
  return (
    <Button
      type="button"
      size="lg"
      variant={variant}
      disabled={isPending}
      onClick={onClick}
      className={cn(
        'h-16 w-full max-w-md rounded-full px-10 text-2xl shadow-lift active:translate-y-0.5',
        className,
      )}
    >
      {isPending && <Spinner className="animate-spin" aria-hidden="true" />}
      {isPending ? t('childWelcome.actions.saving') : label}
    </Button>
  );
}
