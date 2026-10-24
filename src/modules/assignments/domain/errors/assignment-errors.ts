/**
 * Stable validation codes of the assignment draft. Presentation maps them to translation keys
 * (`presentation/messages/message-keys.ts`); nothing here is user-facing prose.
 */
export const ASSIGNMENTS_VALIDATION_CODES = {
  titleRequired: 'assignments.validation.title_required',
  titleTooLong: 'assignments.validation.title_too_long',
  taskRequired: 'assignments.validation.task_required',
  taskTooLong: 'assignments.validation.task_too_long',
  dateInvalid: 'assignments.validation.date_invalid',
  solutionTooLong: 'assignments.validation.solution_too_long',
} as const;

export type AssignmentCode =
  (typeof ASSIGNMENTS_VALIDATION_CODES)[keyof typeof ASSIGNMENTS_VALIDATION_CODES];
