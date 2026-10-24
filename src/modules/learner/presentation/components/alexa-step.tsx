'use client';

import { useId } from 'react';
import type { BaseSyntheticEvent } from 'react';

import { Alert, AlertDescription } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { CircleCheck, Clock, Mic, Volume2 } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useAlexaLinking } from '../hooks/use-alexa-linking';

import { StepFrame } from './step-frame';

export interface AlexaStepProps {
  readonly stepNumber: number;
  readonly shouldTakeFocus: boolean;
  readonly onBack: () => void;
  readonly onContinue: () => void;
}

/**
 * The optional Alexa step. Today it is a placeholder: the linking does not exist yet, so the
 * button is disabled, the screen says "not available yet", and nothing is saved. It already draws the
 * states of the real thing (not connected, connected), driven by `useAlexaLinking`, so building the
 * linking means replacing that hook. The step is always skippable and the setup never depends on it.
 */
export function AlexaStep({ stepNumber, shouldTakeFocus, onBack, onContinue }: AlexaStepProps) {
  const t = useTranslations('learner');
  const id = useId();
  const { status, connect, disconnect } = useAlexaLinking();
  const isLinked = status === 'linked';

  return (
    <StepFrame
      stepNumber={stepNumber}
      shouldTakeFocus={shouldTakeFocus}
      title={t('alexa.title')}
      description={t('alexa.description')}
      submitLabel={isLinked ? t('alexa.continue') : t('alexa.later')}
      onSubmit={(event?: BaseSyntheticEvent) => {
        event?.preventDefault();
        onContinue();
      }}
      onBack={onBack}
    >
      <div className="flex flex-col items-center gap-4 rounded-token-xl bg-secondary/50 p-6 text-center">
        <span
          aria-hidden="true"
          className="flex size-24 items-center justify-center rounded-full border-4 border-primary-copy bg-surface text-primary-copy shadow-soft"
        >
          <Mic className="size-10" />
        </span>
        <p className="flex items-center gap-2 font-heading text-lg font-semibold text-secondary-foreground">
          <Volume2 className="size-5 shrink-0" aria-hidden="true" />
          {t('alexa.hero')}
        </p>
        <p className="flex items-center gap-2 rounded-full bg-hint-subtle px-3 py-1 text-sm font-semibold text-hint">
          {isLinked ? (
            <CircleCheck className="size-4" aria-hidden="true" />
          ) : (
            <Clock className="size-4" aria-hidden="true" />
          )}
          {t(`alexa.status.${status}`)}
        </p>
      </div>
      {isLinked ? (
        <Alert variant="success">
          <CircleCheck aria-hidden="true" />
          <AlertDescription>{t('alexa.linkedNote')}</AlertDescription>
        </Alert>
      ) : (
        <p id={`${id}-note`} className="text-copy-muted">
          {t('alexa.unavailableNote')}
        </p>
      )}
      <Button
        type="button"
        size="lg"
        variant={isLinked ? 'outline' : 'default'}
        disabled={status === 'unavailable'}
        aria-describedby={`${id}-note`}
        onClick={isLinked ? disconnect : connect}
      >
        {isLinked ? t('alexa.disconnect') : t('alexa.connect')}
      </Button>
    </StepFrame>
  );
}
