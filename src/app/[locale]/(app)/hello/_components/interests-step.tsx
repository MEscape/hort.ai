'use client';

import { INTERESTS, LEARNER_LIMITS } from '@modules/learner/client';
import type { Interest, TutorOption } from '@modules/learner/client';
import { CompanionAvatar } from '@modules/progression/client';
import type { ProgressDto } from '@modules/progression/client';

import { Hort } from '@components/brand/hort';

import { useTranslations } from '@i18n/client';

import { InterestSlots } from './interest-slots';
import { InterestTile } from './interest-tile';
import { SpeechBubble } from './speech-bubble';
import { StepButton } from './step-button';
import { StepScene } from './step-scene';
import { useInterestChoice } from './use-interest-choice';

export interface InterestsStepProps {
  /** What is chosen now: the parent's choice at first, then whatever the child changed. */
  readonly interests: readonly Interest[];
  readonly tutor: TutorOption | null;
  readonly progress: ProgressDto;
  readonly onChange: (interests: readonly Interest[]) => void;
  readonly isSaving: boolean;
  /** True when the last save failed: the choices stay and the button tries again. */
  readonly hasError: boolean;
  readonly onContinue: () => void;
}

/**
 * Big picture tiles to tap, no reading needed. Four stars at the top fill with the chosen pictures;
 * when all four are full the other tiles dim and a tap on one only shakes it, while a chosen tile
 * frees its star again at once. The parent's choices are where the child starts; none is fine too.
 */
export function InterestsStep({
  interests,
  tutor,
  progress,
  onChange,
  isSaving,
  hasError,
  onContinue,
}: InterestsStepProps) {
  const t = useTranslations('learner');
  const max = LEARNER_LIMITS.maxInterests;
  const { isFull, picks, feedback, toggle, clearFeedback } = useInterestChoice(
    interests,
    onChange,
    max,
  );

  return (
    <StepScene
      title={t('childWelcome.interests.title')}
      error={hasError ? t('childWelcome.saveError') : undefined}
      hasFade
      className="justify-start gap-5"
      footer={
        <StepButton
          label={hasError ? t('childWelcome.actions.retry') : t('childWelcome.actions.next')}
          isPending={isSaving}
          onClick={onContinue}
        />
      }
    >
      <div className="flex w-full items-center gap-4">
        <span key={picks} className="size-20 shrink-0 animate-hop">
          {tutor === null ? (
            <Hort mood="happy" className="size-full" />
          ) : (
            <CompanionAvatar
              companion={tutor}
              mood={progress.mood}
              boredomLevel={progress.boredomLevel}
              className="size-full"
            />
          )}
        </span>
        <SpeechBubble
          tail="left"
          isLive
          text={
            isFull ? t('childWelcome.interests.full', { max }) : t('childWelcome.interests.bubble')
          }
        />
      </div>
      <InterestSlots interests={interests} max={max} />
      <div
        role="group"
        aria-label={t('childWelcome.interests.title')}
        className="grid w-full grid-cols-2 gap-4 px-1 pb-4 sm:grid-cols-3 lg:grid-cols-5"
      >
        {INTERESTS.map((interest) => {
          const isSelected = interests.includes(interest);
          return (
            <InterestTile
              key={interest}
              interest={interest}
              isSelected={isSelected}
              isBlocked={isFull && !isSelected}
              isDisabled={isSaving}
              feedback={feedback}
              onToggle={toggle}
              onFeedbackEnd={clearFeedback}
            />
          );
        })}
      </div>
    </StepScene>
  );
}
