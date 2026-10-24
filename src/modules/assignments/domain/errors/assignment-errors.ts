import { FieldErrorBag, conflictError, notFoundError, validationError } from '@lib/errors';
import type { ConflictAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';

/**
 * Stable codes. Presentation maps them to translation keys (`presentation/messages/message-keys.ts`);
 * nothing here is user-facing prose.
 *
 * `notFound` is deliberately the ONE outcome for "no such assignment" and "another teacher's
 * assignment": codes reach the client, and a separate code would disclose that the id exists.
 */
export const ASSIGNMENTS_ERROR_CODES = {
  notFound: 'assignments.not_found',
  validationFailed: 'assignments.validation_failed',
  persistenceFailed: 'assignments.persistence_failed',
  invalidId: 'assignments.invalid_id',
  classroomArchived: 'assignments.classroom_archived',
} as const;

/** Field-level codes of the assignment draft, carried in `fieldErrors`. */
export const ASSIGNMENTS_VALIDATION_CODES = {
  titleRequired: 'assignments.validation.title_required',
  titleTooLong: 'assignments.validation.title_too_long',
  taskRequired: 'assignments.validation.task_required',
  taskTooLong: 'assignments.validation.task_too_long',
  dateInvalid: 'assignments.validation.date_invalid',
  solutionTooLong: 'assignments.validation.solution_too_long',
} as const;

export type AssignmentErrorCode =
  (typeof ASSIGNMENTS_ERROR_CODES)[keyof typeof ASSIGNMENTS_ERROR_CODES];
export type AssignmentValidationCode =
  (typeof ASSIGNMENTS_VALIDATION_CODES)[keyof typeof ASSIGNMENTS_VALIDATION_CODES];
export type AssignmentCode = AssignmentErrorCode | AssignmentValidationCode;

/** Also covers another teacher's assignment: see `ASSIGNMENTS_ERROR_CODES`. */
export function assignmentNotFound(): NotFoundAppError {
  return notFoundError(ASSIGNMENTS_ERROR_CODES.notFound, 'Assignment not found.');
}

/** An archived class is read-only: it takes no new assignments. */
export function classroomArchived(): ConflictAppError {
  return conflictError(ASSIGNMENTS_ERROR_CODES.classroomArchived, 'The classroom is archived.');
}

export function invalidAssignmentId(): ValidationAppError {
  return validationError(ASSIGNMENTS_ERROR_CODES.invalidId, 'Invalid identifier.', {});
}

export function createAssignmentErrorBag(): FieldErrorBag {
  return new FieldErrorBag((fieldErrors) =>
    validationError(
      ASSIGNMENTS_ERROR_CODES.validationFailed,
      'The assignment is invalid.',
      fieldErrors,
    ),
  );
}
