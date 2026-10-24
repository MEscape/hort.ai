import { z } from 'zod';

/** UI-only bounds until the assignment creation contract exists (issue #33). */
export const ASSIGNMENT_DRAFT_LIMITS = { title: 120, taskText: 4000, solutionKey: 4000 } as const;
export const ASSIGNMENT_VALIDATION_CODES = {
  titleRequired: 'titleRequired',
  titleTooLong: 'titleTooLong',
  taskRequired: 'taskRequired',
  taskTooLong: 'taskTooLong',
  dateInvalid: 'dateInvalid',
  solutionTooLong: 'solutionTooLong',
} as const;

export type AssignmentValidationCode =
  (typeof ASSIGNMENT_VALIDATION_CODES)[keyof typeof ASSIGNMENT_VALIDATION_CODES];

const calendarDateSchema = z.iso.date();

/** Local preview validation; future Server Actions must validate again at their own boundary. */
export const assignmentDraftSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, ASSIGNMENT_VALIDATION_CODES.titleRequired)
    .max(ASSIGNMENT_DRAFT_LIMITS.title, ASSIGNMENT_VALIDATION_CODES.titleTooLong),
  taskText: z
    .string()
    .trim()
    .min(1, ASSIGNMENT_VALIDATION_CODES.taskRequired)
    .max(ASSIGNMENT_DRAFT_LIMITS.taskText, ASSIGNMENT_VALIDATION_CODES.taskTooLong),
  dueDate: z
    .string()
    .refine(
      (value) => value === '' || calendarDateSchema.safeParse(value).success,
      ASSIGNMENT_VALIDATION_CODES.dateInvalid,
    ),
  solutionKey: z
    .string()
    .trim()
    .max(ASSIGNMENT_DRAFT_LIMITS.solutionKey, ASSIGNMENT_VALIDATION_CODES.solutionTooLong),
});

export type AssignmentDraft = z.infer<typeof assignmentDraftSchema>;
