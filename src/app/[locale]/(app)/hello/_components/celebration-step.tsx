'use client';

import type { TutorOption } from '@modules/learner/client';
import { CompanionAvatar } from '@modules/progression/client';

import { useTranslations } from '@i18n/client';

import { StarConfetti } from './star-confetti';
import { StepButton } from './step-button';
import { StepHero } from './step-hero';
import { StepScene } from './step-scene';

export interface CelebrationStepProps {
  readonly name: string;
  readonly tutor: TutorOption;
  /** True while the end of the welcome is being stored. */
  readonly isSaving: boolean;
  readonly error: string | undefined;
  readonly onFinish: () => void;
}

/**
 * The end: the chosen companion cheers among falling stars, one line, one button. The button stores
 * the end of the welcome and only then leaves; a failed store shows the error and the same button
 * tries again.
 */
export function CelebrationStep({ name, tutor, isSaving, error, onFinish }: CelebrationStepProps) {
  const t = useTranslations('learner');
  return (
    <StepScene
      title={t('childWelcome.celebration.title', { name })}
      error={error}
      footer={
        <StepButton
          label={
            error === undefined
              ? t('childWelcome.celebration.start')
              : t('childWelcome.actions.retry')
          }
          isPending={isSaving}
          onClick={onFinish}
        />
      }
    >
      <StarConfetti />
      <StepHero bubble={t('childWelcome.celebration.bubble', { companion: tutor.name })}>
        <CompanionAvatar
          companion={tutor}
          mood="cheerful"
          boredomLevel={0}
          reaction="cheer"
          className="size-full"
        />
      </StepHero>
    </StepScene>
  );
}
