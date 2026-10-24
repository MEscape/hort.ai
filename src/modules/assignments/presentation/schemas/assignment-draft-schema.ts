import { z } from 'zod';

import { ASSIGNMENTS_VALIDATION_CODES } from '../../application/contracts/assignment-constraints';

/** UI-only bounds until the assignment creation contract exists (issue #33). */
export const ASSIGNMENT_DRAFT_LIMITS = { title: 120, taskText: 4000, solutionKey: 4000 } as const;
const calendarDateSchema = z.iso.date();

const CODES = ASSIGNMENTS_VALIDATION_CODES;

/** Local preview validation; future Server Actions must validate again at their own boundary. */
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
