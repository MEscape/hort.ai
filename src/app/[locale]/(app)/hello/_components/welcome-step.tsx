'use client';

import type { TutorOption } from '@modules/learner/client';
import { CompanionAvatar } from '@modules/progression/client';
import type { ProgressDto } from '@modules/progression/client';

import { Hort } from '@components/brand/hort';

import { useTranslations } from '@i18n/client';

import { StepButton } from './step-button';
import { StepHero } from './step-hero';
import { StepScene } from './step-scene';

export interface WelcomeStepProps {
  readonly name: string;
  /** The companion the parent picked; `null` when the parent skipped it, then Hort says hello. */
  readonly tutor: TutorOption | null;
  /** The real progress: the companion's mood and how bored it looks. */
  readonly progress: ProgressDto;
  readonly onStart: () => void;
}

/** The companion says hello: one big picture, one line, one button. Nothing is asked yet. */
export function WelcomeStep({ name, tutor, progress, onStart }: WelcomeStepProps) {
  const t = useTranslations('learner');
  return (
    <StepScene
      title={t('childWelcome.welcome.title', { name })}
      footer={
        <StepButton label={t('childWelcome.welcome.start')} isPending={false} onClick={onStart} />
      }
    >
      <StepHero bubble={t('childWelcome.welcome.bubble', { companion: tutor?.name ?? 'Hort' })}>
        {tutor === null ? (
          <Hort mood="hello" isAmbient className="size-full" />
        ) : (
          <CompanionAvatar
            companion={tutor}
            mood={progress.mood}
            boredomLevel={progress.boredomLevel}
            className="size-full"
          />
        )}
      </StepHero>
    </StepScene>
  );
}
