'use client';

import type { BaseSyntheticEvent } from 'react';

import { ShieldCheck, Sparkles, UserPlus, Users } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { StepFrame } from './step-frame';

export interface WelcomeStepProps {
  readonly stepNumber: number;
  readonly shouldTakeFocus: boolean;
  readonly onStart: () => void;
}

const ITEMS = [
  { key: 'child', icon: UserPlus },
  { key: 'companion', icon: Sparkles },
  { key: 'controls', icon: Users },
] as const;

/** The first screen: what will happen and how little is asked, before anything is asked. */
export function WelcomeStep({ stepNumber, shouldTakeFocus, onStart }: WelcomeStepProps) {
  const t = useTranslations('learner');

  return (
    <StepFrame
      stepNumber={stepNumber}
      shouldTakeFocus={shouldTakeFocus}
      title={t('welcome.title')}
      description={t('welcome.description')}
      submitLabel={t('welcome.start')}
      onSubmit={(event?: BaseSyntheticEvent) => {
        event?.preventDefault();
        onStart();
      }}
    >
      <ul aria-label={t('welcome.listLabel')} className="flex flex-col gap-3">
        {ITEMS.map(({ key, icon: Icon }) => (
          <li
            key={key}
            className="flex items-start gap-4 rounded-token-lg border border-border bg-surface p-4"
          >
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-token bg-secondary text-secondary-foreground"
            >
              <Icon className="size-6" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-heading text-lg font-semibold">
                {t(`welcome.items.${key}.title`)}
              </span>
              <span className="text-copy-muted">{t(`welcome.items.${key}.description`)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-3 rounded-token-lg bg-hint-subtle px-4 py-3 font-semibold text-hint">
        <ShieldCheck className="size-6 shrink-0" aria-hidden="true" />
        {t('welcome.promise')}
      </p>
    </StepFrame>
  );
}
