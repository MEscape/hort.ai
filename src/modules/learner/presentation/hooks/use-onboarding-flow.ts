'use client';

import { useState } from 'react';

import type { ChildProfileDto, OnboardingStateDto } from '../dto/learner-dto';

/** The screens in the order the parent sees them. */
export const ONBOARDING_STAGES = [
  'welcome',
  'child',
  'interests',
  'tutor',
  'alexa',
  'controls',
  'review',
  'done',
] as const;
export type OnboardingStage = (typeof ONBOARDING_STAGES)[number];

/** Where a visit starts: the backend knows the furthest step the parent reached. */
function initialStage(initial: OnboardingStateDto): OnboardingStage {
  if (initial.profile === null) {
    return 'welcome';
  }
  return ONBOARDING_STAGES.includes(initial.step) ? initial.step : 'review';
}

export interface OnboardingFlowState {
  readonly stage: OnboardingStage;
  /** 1-based, for "Step 2 of 7". */
  readonly stepNumber: number;
  /** True once the parent moved between screens: only then does a screen take focus. */
  readonly hasNavigated: boolean;
  readonly profile: ChildProfileDto | null;
  readonly goTo: (stage: OnboardingStage) => void;
  /** One screen back; from an edit started on the review screen it leads back to the review. */
  readonly back: () => void;
  /** Change an earlier answer from the review screen; saving returns to the review. */
  readonly edit: (stage: OnboardingStage) => void;
  /** The backend stored a step: show what the backend returned and move on. */
  readonly saved: (profile: ChildProfileDto, next: OnboardingStage) => void;
}

/**
 * Which onboarding screen is in front of the parent. The server decides where a visit starts, and a
 * screen is left only after the backend confirmed it. The welcome screen is the only one that
 * changes no data. An edit started from the review returns there, so changing a name never
 * means walking through every step again.
 */
export function useOnboardingFlow(initial: OnboardingStateDto): OnboardingFlowState {
  const [stage, setStage] = useState<OnboardingStage>(initialStage(initial));
  const [profile, setProfile] = useState<ChildProfileDto | null>(initial.profile);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const move = (next: OnboardingStage) => {
    setHasNavigated(true);
    setStage(next);
  };

  return {
    stage,
    stepNumber: ONBOARDING_STAGES.indexOf(stage) + 1,
    hasNavigated,
    profile,
    goTo: move,
    back: () => {
      setIsEditing(false);
      move(
        isEditing
          ? 'review'
          : (ONBOARDING_STAGES[Math.max(0, ONBOARDING_STAGES.indexOf(stage) - 1)] ?? 'welcome'),
      );
    },
    edit: (target) => {
      setIsEditing(true);
      move(target);
    },
    saved: (next, following) => {
      setProfile(next);
      move(isEditing && following !== 'done' ? 'review' : following);
      setIsEditing(false);
    },
  };
}
