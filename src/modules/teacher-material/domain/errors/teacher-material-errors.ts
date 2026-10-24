import { notFoundError, validationError } from '@lib/errors';
import type { NotFoundAppError, ValidationAppError } from '@lib/errors';

/**
 * Stable codes. Presentation maps these to translation keys (i18n.md);
 * nothing here is user-facing prose.
 *
 * `notFound` is deliberately the ONE outcome for "no such teacher-material" and
 * "teacher-material belongs to another tenant": codes reach the client, and a
 * separate code would disclose that the id exists elsewhere.
 */
export const TEACHER_MATERIAL_ERROR_CODES = {
  notFound: 'teacher_material.not_found',
  validationFailed: 'teacher_material.validation_failed',
  persistenceFailed: 'teacher_material.persistence_failed',
} as const;

/** Field-level codes, carried in `fieldErrors`. Also stable, also never prose. */
export const TEACHER_MATERIAL_VALIDATION_CODES = {
  idInvalid: 'teacher_material.validation.id_invalid',
  required: 'teacher_material.validation.required',
  tooLong: 'teacher_material.validation.too_long',
} as const;

export type TeacherMaterialErrorCode =
  (typeof TEACHER_MATERIAL_ERROR_CODES)[keyof typeof TEACHER_MATERIAL_ERROR_CODES];
export type TeacherMaterialValidationCode =
  (typeof TEACHER_MATERIAL_VALIDATION_CODES)[keyof typeof TEACHER_MATERIAL_VALIDATION_CODES];
export type TeacherMaterialCode = TeacherMaterialErrorCode | TeacherMaterialValidationCode;

/** Also covers another tenant's teacher-material: see `TEACHER_MATERIAL_ERROR_CODES`. */
export function teacherMaterialNotFound(): NotFoundAppError {
  return notFoundError(
    TEACHER_MATERIAL_ERROR_CODES.notFound,
    'The teacher material was not found.',
  );
}

export function teacherMaterialValidationFailed(
  fieldErrors: Record<string, string[]>,
): ValidationAppError {
  return validationError(
    TEACHER_MATERIAL_ERROR_CODES.validationFailed,
    'The teacher material input is invalid.',
    fieldErrors,
  );
}

/** A validation failure on a single field. */
export function fieldValidationFailed(
  field: string,
  code: TeacherMaterialValidationCode,
): ValidationAppError {
  return teacherMaterialValidationFailed({ [field]: [code] });
}
