import { notFoundError, validationError } from '@lib/errors';
import type { NotFoundAppError, ValidationAppError } from '@lib/errors';

/**
 * Stable codes. Presentation maps these to translation keys; nothing here is user-facing prose.
 *
 * `notFound` is the ONE outcome for "no such child" and "the child belongs to another parent":
 * codes reach the client, and a separate code would disclose that the id exists elsewhere.
 */
export const PROGRESSION_ERROR_CODES = {
  notFound: 'progression.not_found',
  validationFailed: 'progression.validation_failed',
  persistenceFailed: 'progression.persistence_failed',
} as const;

/** Field-level codes, carried in `fieldErrors`. Also stable, also never prose. */
export const PROGRESSION_VALIDATION_CODES = {
  idInvalid: 'progression.validation.id_invalid',
  eventInvalid: 'progression.validation.event_invalid',
  eventKeyInvalid: 'progression.validation.event_key_invalid',
} as const;

type ProgressionErrorCode = (typeof PROGRESSION_ERROR_CODES)[keyof typeof PROGRESSION_ERROR_CODES];
type ProgressionValidationCode =
  (typeof PROGRESSION_VALIDATION_CODES)[keyof typeof PROGRESSION_VALIDATION_CODES];
export type ProgressionCode = ProgressionErrorCode | ProgressionValidationCode;

/** Also covers another parent's child: see `PROGRESSION_ERROR_CODES`. */
export function childNotFound(): NotFoundAppError {
  return notFoundError(PROGRESSION_ERROR_CODES.notFound, 'The child was not found.');
}

function progressionValidationFailed(fieldErrors: Record<string, string[]>): ValidationAppError {
  return validationError(
    PROGRESSION_ERROR_CODES.validationFailed,
    'The progression input is invalid.',
    fieldErrors,
  );
}

/** A validation failure on a single field. */
export function fieldValidationFailed(
  field: string,
  code: ProgressionValidationCode,
): ValidationAppError {
  return progressionValidationFailed({ [field]: [code] });
}
