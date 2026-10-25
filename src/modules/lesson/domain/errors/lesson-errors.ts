import { notFoundError, validationError } from '@lib/errors';
import type { NotFoundAppError, ValidationAppError } from '@lib/errors';

/**
 * Stable codes. Presentation maps these to translation keys; nothing here is user-facing prose.
 *
 * `notFound` is the ONE outcome for an unknown lesson or step and for another parent's child: codes
 * reach the client, and a separate code would disclose that the child id exists elsewhere.
 */
export const LESSON_ERROR_CODES = {
  notFound: 'lesson.not_found',
  validationFailed: 'lesson.validation_failed',
  /** The child's typed words say they may be in danger (#90): answered with the trusted-adult notice only. */
  childDistress: 'lesson.child_distress',
} as const;

/** Field-level codes, carried in `fieldErrors`. Also stable, also never prose. */
export const LESSON_VALIDATION_CODES = {
  idInvalid: 'lesson.validation.id_invalid',
  answerInvalid: 'lesson.validation.answer_invalid',
} as const;

type LessonErrorCode = (typeof LESSON_ERROR_CODES)[keyof typeof LESSON_ERROR_CODES];
type LessonValidationCode = (typeof LESSON_VALIDATION_CODES)[keyof typeof LESSON_VALIDATION_CODES];
export type LessonCode = LessonErrorCode | LessonValidationCode;

/** Also covers another parent's child: see `LESSON_ERROR_CODES`. */
export function lessonNotFound(): NotFoundAppError {
  return notFoundError(LESSON_ERROR_CODES.notFound, 'The lesson was not found.');
}

/** Nothing of the text is judged, stored or logged; the child sees the trusted-adult notice. */
export function childDistress(): ValidationAppError {
  return validationError(LESSON_ERROR_CODES.childDistress, 'The child may be in danger.', {});
}

/** A validation failure on a single field. */
export function fieldValidationFailed(
  field: string,
  code: LessonValidationCode,
): ValidationAppError {
  return validationError(LESSON_ERROR_CODES.validationFailed, 'The lesson input is invalid.', {
    [field]: [code],
  });
}
