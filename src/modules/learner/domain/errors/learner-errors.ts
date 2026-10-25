import {
  FieldErrorBag,
  conflictError,
  forbiddenError,
  notFoundError,
  validationError,
} from '@lib/errors';
import type {
  ConflictAppError,
  ForbiddenAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';

/**
 * Stable codes. Presentation maps these to translation keys (i18n.md); nothing here is user-facing
 * prose.
 *
 * `notFound` is the ONE outcome for "no such child profile" and "the profile belongs to another
 * parent": codes reach the client, and a separate code would disclose that the id exists elsewhere.
 */
export const LEARNER_ERROR_CODES = {
  notFound: 'learner.not_found',
  alreadyOnboarded: 'learner.already_onboarded',
  setupIncomplete: 'learner.setup_incomplete',
  welcomeAlreadyCompleted: 'learner.welcome_already_completed',
  devResetUnavailable: 'learner.dev_reset_unavailable',
  validationFailed: 'learner.validation_failed',
  persistenceFailed: 'learner.persistence_failed',
} as const;

/** Field-level codes, carried in `fieldErrors`. Also stable, also never prose. */
export const LEARNER_VALIDATION_CODES = {
  idInvalid: 'learner.validation.id_invalid',
  displayNameRequired: 'learner.validation.display_name_required',
  displayNameTooLong: 'learner.validation.display_name_too_long',
  displayNameInvalid: 'learner.validation.display_name_invalid',
  federalStateInvalid: 'learner.validation.federal_state_invalid',
  gradeInvalid: 'learner.validation.grade_invalid',
  tutorInvalid: 'learner.validation.tutor_invalid',
  interestsInvalid: 'learner.validation.interests_invalid',
  interestsTooMany: 'learner.validation.interests_too_many',
  dailyLimitInvalid: 'learner.validation.daily_limit_invalid',
  windowInvalid: 'learner.validation.window_invalid',
  guardianConfirmationRequired: 'learner.validation.guardian_confirmation_required',
} as const;

type LearnerErrorCode = (typeof LEARNER_ERROR_CODES)[keyof typeof LEARNER_ERROR_CODES];
type LearnerValidationCode =
  (typeof LEARNER_VALIDATION_CODES)[keyof typeof LEARNER_VALIDATION_CODES];
export type LearnerCode = LearnerErrorCode | LearnerValidationCode;

/** Also covers another parent's profile: see `LEARNER_ERROR_CODES`. */
export function childProfileNotFound(): NotFoundAppError {
  return notFoundError(LEARNER_ERROR_CODES.notFound, 'The child profile was not found.');
}

/** The parent's child is already set up; adding further children is not supported yet. */
export function alreadyOnboarded(): ConflictAppError {
  return conflictError(LEARNER_ERROR_CODES.alreadyOnboarded, 'The child is already set up.');
}

/** The setup is completed before every step was walked: the parent still has steps to finish. */
export function setupIncomplete(): ConflictAppError {
  return conflictError(LEARNER_ERROR_CODES.setupIncomplete, 'The setup is not ready to finish.');
}

/** The child already did their welcome; it runs once, so its choices are closed. */
export function welcomeAlreadyCompleted(): ConflictAppError {
  return conflictError(
    LEARNER_ERROR_CODES.welcomeAlreadyCompleted,
    'The child already finished the welcome.',
  );
}

/** The development-only onboarding reset was called where it is switched off (production). Says nothing about the parent's data. */
export function devResetUnavailable(): ForbiddenAppError {
  return forbiddenError(
    LEARNER_ERROR_CODES.devResetUnavailable,
    'The onboarding reset is not available.',
  );
}

function learnerValidationFailed(fieldErrors: Record<string, string[]>): ValidationAppError {
  return validationError(
    LEARNER_ERROR_CODES.validationFailed,
    'The child profile input is invalid.',
    fieldErrors,
  );
}

/** One place wires the bag to this module's error factory. */
export function createLearnerErrorBag(): FieldErrorBag {
  return new FieldErrorBag(learnerValidationFailed);
}

/** A validation failure on a single field. */
export function fieldValidationFailed(
  field: string,
  code: LearnerValidationCode,
): ValidationAppError {
  return learnerValidationFailed({ [field]: [code] });
}
