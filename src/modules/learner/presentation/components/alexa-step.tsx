'use client';

import { useId } from 'react';
import type { BaseSyntheticEvent } from 'react';

import { Hort } from '@components/brand/hort';
import { Alert, AlertDescription } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { CircleCheck, Clock } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useAlexaLinking } from '../hooks/use-alexa-linking';

import { SmartSpeaker } from './smart-speaker';
import { StepFrame } from './step-frame';

export interface AlexaStepProps {
  readonly stepNumber: number;
  readonly shouldTakeFocus: boolean;
  readonly onBack: () => void;
  readonly onContinue: () => void;
}

const HOW_STEPS = ['link', 'say', 'help'] as const;

/**
 * The optional Alexa step: a drawing of a speaker with Hort peeking out, the sentence a child
 * would say, and three short steps of how it will work. Today it is a placeholder: the linking does
 * not exist yet, so the button is disabled, the screen says "not available yet", and nothing is saved.
 * It already draws the states of the real thing (not connected, connected), driven by
 * `useAlexaLinking`, so building the linking means replacing that hook. The step is always skippable and
 * the setup never depends on it. The drawing is our own: no brand artwork is used.
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
      <div className="relative flex flex-col items-center gap-2 rounded-token-xl border border-border bg-highlight/70 px-6 pt-8 pb-6">
        <p className="relative rounded-token-xl bg-secondary px-4 py-2 font-heading text-lg font-semibold text-secondary-foreground shadow-soft after:absolute after:-bottom-2 after:left-1/2 after:size-4 after:-translate-x-1/2 after:rotate-45 after:rounded-sm after:bg-secondary after:content-['']">
          {t('alexa.command')}
        </p>
        <div className="relative mt-3">
          <span className="absolute -bottom-1 -left-12 block origin-bottom motion-safe:animate-float">
            <Hort mood="hello" className="size-24 -rotate-6" />
          </span>
          <SmartSpeaker className="relative w-56" />
        </div>
        <p className="flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-sm font-semibold text-copy shadow-soft">
          {isLinked ? (
            <CircleCheck className="size-4 text-success" aria-hidden="true" />
          ) : (
            <Clock className="size-4 text-copy-muted" aria-hidden="true" />
          )}
          {t(`alexa.status.${status}`)}
        </p>
      </div>
      <section aria-label={t('alexa.how.title')} className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">{t('alexa.how.title')}</h2>
        <ol className="flex flex-col gap-2">
          {HOW_STEPS.map((key, index) => (
            <li key={key} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sunken text-sm font-bold text-copy"
              >
                {index + 1}
              </span>
              <span className="pt-0.5 text-copy">{t(`alexa.how.steps.${key}`)}</span>
            </li>
          ))}
        </ol>
      </section>
      {isLinked ? (
        <Alert variant="success">
          <CircleCheck aria-hidden="true" />
          <AlertDescription>{t('alexa.linkedNote')}</AlertDescription>
        </Alert>
      ) : (
        <p id={`${id}-note`} className="text-sm text-copy-muted">
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
