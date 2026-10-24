import { notFoundError, validationError, FieldErrorBag } from '@lib/errors';
import type { NotFoundAppError, ValidationAppError } from '@lib/errors';

/**
 * Stable codes. Presentation maps these to translation keys (i18n.md);
 * nothing here is user-facing prose.
 *
 * `notFound` is deliberately the ONE outcome for "no such child-profile" and
 * "child-profile belongs to another tenant": codes reach the client, and a
 * separate code would disclose that the id exists elsewhere.
 */
export const LEARNER_ERROR_CODES = {
  notFound: 'child_profile.not_found',
  validationFailed: 'learner.validation_failed',
  persistenceFailed: 'learner.persistence_failed',
} as const;

/** Field-level codes, carried in `fieldErrors`. Also stable, also never prose. */
export const LEARNER_VALIDATION_CODES = {
  idInvalid: 'learner.validation.id_invalid',
  required: 'learner.validation.required',
  tooLong: 'learner.validation.too_long',
  numberInvalid: 'learner.validation.number_invalid',
  optionUnknown: 'learner.validation.option_unknown',
} as const;

export type LearnerErrorCode = (typeof LEARNER_ERROR_CODES)[keyof typeof LEARNER_ERROR_CODES];
export type LearnerValidationCode =
  (typeof LEARNER_VALIDATION_CODES)[keyof typeof LEARNER_VALIDATION_CODES];
export type LearnerCode = LearnerErrorCode | LearnerValidationCode;

/** Also covers another tenant's child-profile: see `LEARNER_ERROR_CODES`. */
export function childProfileNotFound(): NotFoundAppError {
  return notFoundError(LEARNER_ERROR_CODES.notFound, 'The child profile was not found.');
}

export function learnerValidationFailed(fieldErrors: Record<string, string[]>): ValidationAppError {
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
