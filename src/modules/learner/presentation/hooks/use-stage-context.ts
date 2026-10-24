'use client';

import type { OnboardingFlowState, OnboardingStage } from './use-onboarding-flow';
import type { TutorOption } from '../components/tutor-option';
import type { ChildProfileDto } from '../dto/learner-dto';

export interface StageContext {
  /** What every step needs: its number and whether it takes focus after a move. */
  readonly common: { readonly stepNumber: number; readonly shouldTakeFocus: boolean };
  readonly stage: OnboardingStage;
  readonly profile: ChildProfileDto | null;
  /** The companion the backend stored for the child, if any. */
  readonly tutor: TutorOption | null;
  readonly back: () => void;
  readonly edit: OnboardingFlowState['edit'];
  readonly start: () => void;
  /** A handler that shows what the backend stored and moves to the stage after it. */
  readonly savedThen: (next: OnboardingStage) => (saved: ChildProfileDto) => void;
}

/** What the stage screens read from the flow, derived once so the screen picker stays a plain choice. */
export function useStageContext(
  flow: OnboardingFlowState,
  tutors: readonly TutorOption[],
): StageContext {
  return {
    common: { stepNumber: flow.stepNumber, shouldTakeFocus: flow.hasNavigated },
    stage: flow.stage,
    profile: flow.profile,
    tutor: tutors.find((option) => option.id === flow.profile?.tutorId) ?? null,
    back: flow.back,
    edit: flow.edit,
    start: () => {
      flow.goTo('child');
    },
    savedThen: (next) => (saved) => {
      flow.saved(saved, next);
    },
  };
}
