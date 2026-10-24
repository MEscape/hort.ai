import { validationError } from '@lib/errors';
import type { ValidationAppError } from '@lib/errors';

/** Stable codes; nothing here is user-facing prose. */
export const CURRICULUM_ERROR_CODES = {
  validationFailed: 'curriculum.validation_failed',
  persistenceFailed: 'curriculum.persistence_failed',
} as const;

/** Field-level codes, carried in `fieldErrors`. */
export const CURRICULUM_VALIDATION_CODES = {
  required: 'curriculum.validation.required',
  tooLong: 'curriculum.validation.too_long',
  invalid: 'curriculum.validation.invalid',
  noStatements: 'curriculum.validation.no_statements',
  tooManyStatements: 'curriculum.validation.too_many_statements',
} as const;

export type CurriculumValidationCode =
  (typeof CURRICULUM_VALIDATION_CODES)[keyof typeof CURRICULUM_VALIDATION_CODES];

export function curriculumInvalid(
  field: string,
  code: CurriculumValidationCode,
): ValidationAppError {
  return validationError(
    CURRICULUM_ERROR_CODES.validationFailed,
    'The curriculum input is invalid.',
    {
      [field]: [code],
    },
  );
}
