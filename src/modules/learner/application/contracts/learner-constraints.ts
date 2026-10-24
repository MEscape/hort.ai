/**
 * Domain constants and codes that presentation legitimately needs (form validation, option lists,
 * message lookup). Presentation may not import the domain, so they are re-exported here as part of
 * the application's contract. Nothing in this file is defined twice.
 */
export { LEARNER_ERROR_CODES, LEARNER_VALIDATION_CODES } from '../../domain/errors/learner-errors';
export type { LearnerCode } from '../../domain/errors/learner-errors';
export { FEDERAL_STATES, GRADES } from '../../domain/models/federal-state';
export type { FederalState, Grade } from '../../domain/models/federal-state';
export { INTERESTS } from '../../domain/models/interests';
export type { Interest } from '../../domain/models/interests';
export { LEARNER_LIMITS } from '../../domain/models/learner-limits';
export {
  DAILY_LIMIT_MINUTES,
  GUARDIAN_CONSENT_VERSION,
  LEARNER_TIME_ZONE,
  isLearningAllowedNow,
} from '../../domain/models/parent-controls';
export type { AllowedWindow, DailyLimitMinutes } from '../../domain/models/parent-controls';
export { SETUP_STEPS } from '../../domain/models/setup-step';
export type { SetupStep } from '../../domain/models/setup-step';
