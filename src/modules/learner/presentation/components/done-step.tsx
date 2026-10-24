'use client';

import type { BaseSyntheticEvent } from 'react';

import { Character } from '@components/brand/character';
import { Hort } from '@components/brand/hort';
import { Button } from '@components/ui/button';
import { ArrowRight, Sparkles } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { isDefined } from '@lib/utils';

import { learnerRoutes } from '../routes';

import { StepFrame } from './step-frame';

import type { TutorOption } from './tutor-option';
import type { ChildProfileDto } from '../dto/learner-dto';

export interface DoneStepProps {
  readonly stepNumber: number;
  readonly shouldTakeFocus: boolean;
  readonly profile: ChildProfileDto;
  readonly tutor: TutorOption | null;
}

/**
 * Shown only after the backend confirmed the setup. The chosen companion pops in and hops once,
 * says hello in their own words, and what was set up is read back as a few chips. On a phone Hort
 * celebrates too (the side column is hidden there). The one thing left is the way into the home.
 */
export function DoneStep({ stepNumber, shouldTakeFocus, profile, tutor }: DoneStepProps) {
  const t = useTranslations('learner');
  const chips = [
    profile.displayName,
    t('done.recapGrade', { grade: profile.grade }),
    t(`states.${profile.federalState}` as 'states.HE'),
    tutor?.name,
    profile.voiceEnabled ? t('done.voiceOn') : t('done.voiceOff'),
  ].filter(isDefined);

  return (
    <StepFrame
      stepNumber={stepNumber}
      shouldTakeFocus={shouldTakeFocus}
      title={t('done.title', { name: profile.displayName })}
      description={t('done.description', {
        name: profile.displayName,
        tutor: tutor?.name ?? 'Hort',
      })}
      submitLabel={t('done.toHome')}
      onSubmit={(event?: BaseSyntheticEvent) => {
        event?.preventDefault();
      }}
      primary={
        <Button asChild size="lg" className="sm:min-w-48">
          <Link href={learnerRoutes.home()}>
            {t('done.toHome')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      {tutor === null ? (
        <div className="flex items-center justify-center gap-4 lg:hidden" aria-hidden="true">
          <Sparkles className="size-6 text-accent-copy" />
          <Hort mood="happy" isAmbient className="size-28" />
          <Sparkles className="size-6 text-accent-copy" />
        </div>
      ) : (
        <div className="relative mt-10 rounded-token-xl border border-border bg-surface px-5 pb-5">
          <div className="-mt-12 flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:gap-5">
            <span className="block origin-bottom animate-hop">
              <Character
                imageUrl={tutor.imageUrl}
                alt={t('tutor.imageAlt', { name: tutor.name, animal: tutor.animal })}
                className="size-32 sm:size-36"
              />
            </span>
            <p
              lang="de"
              className="relative flex-1 animate-pop rounded-token-xl bg-secondary px-4 py-3 font-semibold text-secondary-foreground before:absolute before:-top-2 before:left-1/2 before:size-4 before:-translate-x-1/2 before:rotate-45 before:rounded-sm before:bg-secondary before:content-[''] sm:before:top-auto sm:before:-left-2 sm:before:bottom-6 sm:before:translate-x-0"
            >
              {tutor.greeting}
            </p>
          </div>
        </div>
      )}
      <section aria-label={t('done.recapLabel')} className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-copy-muted">{t('done.recapLabel')}</h2>
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip} className="rounded-full bg-sunken px-3 py-1 text-sm font-semibold">
              {chip}
            </li>
          ))}
        </ul>
      </section>
    </StepFrame>
  );
}
