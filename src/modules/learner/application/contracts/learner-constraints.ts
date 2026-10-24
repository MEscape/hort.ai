/**
 * Domain constants and codes that presentation legitimately needs (form
 * validation, option lists, message lookup). Presentation may not import
 * the domain, so they are re-exported here as part of the application's
 * contract. Nothing in this file is defined twice.
 */
export { LEARNER_ERROR_CODES, LEARNER_VALIDATION_CODES } from '../../domain/errors/learner-errors';
export type { LearnerCode } from '../../domain/errors/learner-errors';
export { CHILD_PROFILE_ID_MAX_LENGTH } from '../../domain/models/ids';
export {
  CHILD_PROFILE_LIMITS,
  CHILD_PROFILE_FEDERAL_STATES,
  CHILD_PROFILE_COMPANIONS,
} from '../../domain/models/child-profile';
export type {
  ChildProfileFederalState,
  ChildProfileCompanion,
} from '../../domain/models/child-profile';
