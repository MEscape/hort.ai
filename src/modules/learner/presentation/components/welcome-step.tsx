'use client';

import type { BaseSyntheticEvent } from 'react';

import { ShieldCheck, Sparkles, UserPlus } from '@components/ui/icons';

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
  { key: 'controls', icon: ShieldCheck },
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
      <ol aria-label={t('welcome.listLabel')} className="flex flex-col gap-3">
        {ITEMS.map(({ key, icon: Icon }, index) => (
          <li
            key={key}
            className="flex items-start gap-4 rounded-token-lg border border-border bg-surface p-4"
          >
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-token bg-sunken text-primary-copy"
            >
              <Icon className="size-5" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-heading text-lg font-semibold">
                {`${index + 1}. ${t(`welcome.items.${key}.title`)}`}
              </span>
              <span className="text-copy-muted">{t(`welcome.items.${key}.description`)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="flex items-center gap-3 rounded-token-lg bg-sunken px-4 py-3 font-semibold text-copy">
        <ShieldCheck className="size-5 shrink-0 text-primary-copy" aria-hidden="true" />
        {t('welcome.promise')}
      </p>
    </StepFrame>
  );
}
