import type {
  ChildProfileView,
  OnboardingStateView,
} from '../../application/contracts/learner-views';

/** What the browser gets of a child profile: plain values only, no dates, no owner. */
export interface ChildProfileDto {
  readonly id: string;
  readonly displayName: string;
  readonly federalState: string;
  readonly grade: number;
  readonly interests: readonly string[];
  readonly tutorId: string | null;
  readonly voiceEnabled: boolean;
  readonly dailyLimitMinutes: number | null;
  /** A time window as minutes since midnight, the way the backend stores it. */
  readonly allowedWindow: { readonly fromMinute: number; readonly untilMinute: number } | null;
  readonly learningInsights: boolean;
  readonly guardianConfirmed: boolean;
}

export interface OnboardingStateDto {
  readonly step: OnboardingStateView['step'];
  readonly profile: ChildProfileDto | null;
}

export function toChildProfileDto(view: ChildProfileView): ChildProfileDto {
  return {
    id: view.id,
    displayName: view.displayName,
    federalState: view.federalState,
    grade: view.grade,
    interests: view.interests,
    tutorId: view.tutorId,
    voiceEnabled: view.controls.voiceEnabled,
    dailyLimitMinutes: view.controls.dailyLimitMinutes,
    allowedWindow: view.controls.allowedWindow,
    learningInsights: view.controls.learningInsights,
    guardianConfirmed: view.guardianConfirmed,
  };
}

export function toOnboardingStateDto(view: OnboardingStateView): OnboardingStateDto {
  return {
    step: view.step,
    profile: view.profile === null ? null : toChildProfileDto(view.profile),
  };
}
