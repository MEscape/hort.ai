'use client';

import type { BaseSyntheticEvent } from 'react';

import { Hort } from '@components/brand/hort';
import { Button } from '@components/ui/button';
import { ArrowRight, Sparkles } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { isDefined } from '@lib/utils';

import { learnerRoutes } from '../routes';

import { StepFrame } from './step-frame';
import { TutorAvatar } from './tutor-avatar';

import type { TutorOption } from './tutor-option';
import type { ChildProfileDto } from '../dto/learner-dto';

export interface DoneStepProps {
  readonly stepNumber: number;
  readonly shouldTakeFocus: boolean;
  readonly profile: ChildProfileDto;
  readonly tutor: TutorOption | null;
}

/**
 * Shown only after the backend confirmed the setup. On a phone Hort celebrates here (the side column
 * is hidden); the chosen companion says hello in their own words, and what was set up is read back
 * as a few chips. The one thing left is the way into the parent's home.
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
      <div className="flex items-center justify-center gap-4 lg:hidden" aria-hidden="true">
        <Sparkles className="size-6 text-accent-copy" />
        <Hort mood="happy" isAmbient className="size-28" />
        <Sparkles className="size-6 text-accent-copy" />
      </div>
      {tutor !== null && (
        <div className="flex items-center gap-4 rounded-token-lg bg-secondary/60 p-4">
          <TutorAvatar
            imageUrl={tutor.imageUrl}
            tone={tutor.tone}
            alt={t('tutor.imageAlt', { name: tutor.name, animal: tutor.animal })}
            className="size-16 sm:size-20"
          />
          <p lang="de" className="font-semibold text-secondary-foreground">
            {tutor.greeting}
          </p>
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
