/**
 * Server-side public API of the learner module: the child profile a parent owns (display name,
 * federal state, grade, plus the interests, companion and controls the parent chose) and the
 * onboarding steps that create it.
 * Server Actions call the commands; Server Components call the query. Every use case authorizes
 * the signed-in parent itself and only ever touches that parent's own profiles.
 */

/** @keep the home page decides from it whether to render the dev reset button (wired by the UI next). */
export { getLearnerCommands, getLearnerQueries, isDevResetAvailable } from './composition';

export type { ChooseTutorError } from './application/commands/choose-tutor';
export type { CompleteSetupError } from './application/commands/complete-setup';
export type { CreateChildProfileError } from './application/commands/create-child-profile';
/** @keep the dev reset action maps this union (wired by the UI next). */
export type { ResetOnboardingError } from './application/commands/reset-onboarding';
export type { SaveControlsError } from './application/commands/save-controls';
export type { SaveInterestsError } from './application/commands/save-interests';
export type { GetChildProfileByIdError } from './application/queries/get-child-profile-by-id';
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

/** Framework entry points: the onboarding screens, the guards pages call, and the module's catalogs. */
export { OnboardingFlow } from './presentation/components/onboarding-flow';
export { ResetOnboardingButton } from './presentation/components/reset-onboarding-button';
export { OnboardingShell } from './presentation/components/onboarding-shell';
export type { TutorOption } from './presentation/components/tutor-option';
export { requireOnboarded, requireOnboarding } from './presentation/guards/require-onboarding';
export { learnerRoutes } from './presentation/routes';
export { default as enLearner } from './presentation/i18n/en.json';
export { default as deLearner } from './presentation/i18n/de.json';
