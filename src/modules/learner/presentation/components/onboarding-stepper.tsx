'use client';

import { Hort } from '@components/brand/hort';
import { Check } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { ONBOARDING_STAGES } from '../hooks/use-onboarding-flow';

import type { OnboardingStage } from '../hooks/use-onboarding-flow';

export interface OnboardingStepperProps {
  readonly stage: OnboardingStage;
  /** 1-based position of the screen in front of the parent. */
  readonly stepNumber: number;
  /** The furthest screen reached; screens before it count as done even while an earlier one is open. */
  readonly reachedNumber?: number;
}

const PERCENT = 100;

/** On a phone: where the parent is, in words and as a bar, small enough to sit above the card. */
function CompactProgress({ stage, stepNumber }: OnboardingStepperProps) {
  const t = useTranslations('learner');

  return (
    <div className="flex items-center gap-3 rounded-token-xl border border-border bg-surface/90 p-3 shadow-soft lg:hidden">
      <Hort mood="hello" className="size-12 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="font-semibold text-copy">
          <span className="text-copy-muted">
            {t('stepper.step', { current: stepNumber, total: ONBOARDING_STAGES.length })}
          </span>
          {' · '}
          {t(`stepper.items.${stage}.title`)}
        </p>
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-soft"
            style={{ width: `${(stepNumber / ONBOARDING_STAGES.length) * PERCENT}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The steps of the setup. Said three ways: the words "Step 2 of 7", the numbered list whose current
 * item is marked for screen readers, and filled dots. A finished step shows a tick, so colour is
 * never the only signal. Wide screens get the list beside the card; phones get the compact bar.
 */
export function OnboardingStepper({
  stage,
  stepNumber,
  reachedNumber = stepNumber,
}: OnboardingStepperProps) {
  const t = useTranslations('learner');

  return (
    <>
      <CompactProgress stage={stage} stepNumber={stepNumber} />
      <nav
        aria-label={t('stepper.label')}
        className="hidden rounded-token-xl border border-border bg-surface/90 p-5 shadow-soft lg:block"
      >
        <ol className="flex flex-col">
          {ONBOARDING_STAGES.map((item, index) => {
            const position = index + 1;
            const isCurrent = position === stepNumber;
            const isDone = !isCurrent && position < reachedNumber;
            return (
              <li
                key={item}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'relative flex items-center gap-3 py-2.5',
                  position < ONBOARDING_STAGES.length &&
                    'before:absolute before:top-[calc(50%+1.25rem)] before:left-4 before:h-[calc(100%-1.5rem)] before:w-0.5 before:-translate-x-1/2 before:bg-border',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold',
                    isCurrent && 'border-primary bg-primary text-primary-foreground',
                    isDone && 'border-success bg-success-subtle text-success',
                    !isCurrent && !isDone && 'border-border-strong bg-surface text-copy-muted',
                  )}
                >
                  {isDone ? <Check className="size-4" strokeWidth={3} /> : position}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span
                    className={cn('font-semibold', isCurrent ? 'text-copy' : 'text-copy-muted')}
                  >
                    {t(`stepper.items.${item}.title`)}
                  </span>
                  <span className="text-sm text-copy-muted">
                    {isDone ? t('stepper.done') : t(`stepper.items.${item}.hint`)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
