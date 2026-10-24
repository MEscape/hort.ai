/**
 * Server-side public API of the learner module: the child profile a parent owns (display name,
 * federal state, grade, plus the interests, companion and controls the parent chose) and the
 * onboarding steps that create it.
 * Server Actions call the commands; Server Components call the query. Every use case authorizes
 * the signed-in parent itself and only ever touches that parent's own profiles.
 */

export { getLearnerCommands, getLearnerQueries } from './composition';

export type { ChooseTutorError } from './application/commands/choose-tutor';
export type { CompleteSetupError } from './application/commands/complete-setup';
export type { CreateChildProfileError } from './application/commands/create-child-profile';
export type { SaveControlsError } from './application/commands/save-controls';
export type { SaveInterestsError } from './application/commands/save-interests';
export type { GetOnboardingStateError } from './application/queries/get-onboarding-state';
export {
  DAILY_LIMIT_MINUTES,
  FEDERAL_STATES,
  GRADES,
  GUARDIAN_CONSENT_VERSION,
  INTERESTS,
  LEARNER_ERROR_CODES,
  LEARNER_LIMITS,
  LEARNER_TIME_ZONE,
  LEARNER_VALIDATION_CODES,
  SETUP_STEPS,
  isLearningAllowedNow,
} from './application/contracts/learner-constraints';
export type {
  DailyLimitMinutes,
  FederalState,
  Grade,
  Interest,
  LearnerCode,
  SetupStep,
} from './application/contracts/learner-constraints';
export type {
  ChooseTutorInput,
  CompleteSetupInput,
  CreateChildProfileInput,
  SaveControlsInput,
  SaveInterestsInput,
} from './application/contracts/learner-inputs';
export type {
  ChildProfileView,
  OnboardingStateView,
  ParentControlsView,
} from './application/contracts/learner-views';
