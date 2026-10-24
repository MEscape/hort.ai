'use client';

import type { BaseSyntheticEvent } from 'react';

import { Button } from '@components/ui/button';
import { ArrowRight } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

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
 * Shown only after the backend confirmed the setup. The chosen companion says hello in their own
 * words, and the one thing left is the way into the parent's home.
 */
export function DoneStep({ stepNumber, shouldTakeFocus, profile, tutor }: DoneStepProps) {
  const t = useTranslations('learner');

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
      {tutor !== null && (
        <div className="flex items-center gap-4 rounded-token-lg bg-secondary/60 p-4">
          <TutorAvatar
            imageUrl={tutor.imageUrl}
            alt={t('tutor.imageAlt', { name: tutor.name, animal: tutor.animal })}
          />
          <p className="font-semibold text-secondary-foreground">{tutor.greeting}</p>
        </div>
      )}
      <p className="text-copy-muted">
        {profile.voiceEnabled ? t('done.voiceOn') : t('done.voiceOff')}
      </p>
    </StepFrame>
  );
}
