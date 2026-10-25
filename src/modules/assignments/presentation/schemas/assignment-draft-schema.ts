import { z } from 'zod';

import {
  ASSIGNMENT_LIMITS,
  ASSIGNMENTS_ERROR_CODES,
  ASSIGNMENTS_VALIDATION_CODES,
} from '../../application/contracts/assignment-constraints';

/** The domain's limits, re-exported for the form's hints and `maxLength`. */
export const ASSIGNMENT_DRAFT_LIMITS = ASSIGNMENT_LIMITS;
const calendarDateSchema = z.iso.date();

const CODES = ASSIGNMENTS_VALIDATION_CODES;

/**
 * The form's fields, used for the editor and again as Server Action input. Messages are stable
 * codes, never prose. The domain checks every rule again; unknown keys (a tenant, an owner) are
 * dropped.
 */
export const assignmentDraftSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, CODES.titleRequired)
    .max(ASSIGNMENT_DRAFT_LIMITS.title, CODES.titleTooLong),
  taskText: z
    .string()
    .trim()
    .min(1, CODES.taskRequired)
    .max(ASSIGNMENT_DRAFT_LIMITS.taskText, CODES.taskTooLong),
  dueDate: z
    .string()
    .refine(
      (value) => value === '' || calendarDateSchema.safeParse(value).success,
      CODES.dateInvalid,
    ),
  solutionKey: z.string().trim().max(ASSIGNMENT_DRAFT_LIMITS.solutionKey, CODES.solutionTooLong),
});

export type AssignmentDraft = z.infer<typeof assignmentDraftSchema>;

/** Long enough for any id the server issues; the domain parses it again. */
const ID_INPUT_MAX = 128;
const idSchema = z
  .string()
  .min(1, ASSIGNMENTS_ERROR_CODES.invalidId)
  .max(ID_INPUT_MAX, ASSIGNMENTS_ERROR_CODES.invalidId);

export const newAssignmentSchema = assignmentDraftSchema.extend({ classroomId: idSchema });

export const updateAssignmentSchema = assignmentDraftSchema.extend({ id: idSchema });

export const assignmentIdSchema = z.object({ id: idSchema });
