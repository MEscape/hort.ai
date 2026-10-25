import {
  hasCurrentGuardianConfirmation,
  hasCurrentVoiceConsent,
} from '../domain/models/child-profile';

import type { ChildProfileView, OnboardingStateView } from './contracts/learner-views';
import type { ChildProfile } from '../domain/models/child-profile';
import type { OnboardingState } from '../domain/models/onboarding-state';

export function toChildProfileView(profile: ChildProfile): ChildProfileView {
  return {
    id: profile.id,
    displayName: profile.displayName,
    federalState: profile.federalState,
    grade: profile.grade,
    interests: profile.interests,
    tutorId: profile.tutorId,
    controls: { ...profile.controls },
    guardianConfirmed: hasCurrentGuardianConfirmation(profile),
    voiceConsent: hasCurrentVoiceConsent(profile),
    setupStep: profile.setupStep,
    setupCompletedAt: profile.setupCompletedAt,
    welcomeCompletedAt: profile.welcomeCompletedAt,
  };
}

export function toOnboardingStateView(state: OnboardingState): OnboardingStateView {
  return {
    step: state.step,
    profile: state.profile === null ? null : toChildProfileView(state.profile),
  };
}
