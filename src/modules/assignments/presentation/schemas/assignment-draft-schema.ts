import { z } from 'zod';

/** UI-only bounds until the assignment creation contract exists (issue #33). */
export const ASSIGNMENT_DRAFT_LIMITS = { title: 120, taskText: 4000, solutionKey: 4000 } as const;
const calendarDateSchema = z.iso.date();

/** Stable validation codes; presentation/messages/message-keys.ts maps them to translation keys. */
export const ASSIGNMENT_VALIDATION_CODES = {
  titleRequired: 'titleRequired',
  titleTooLong: 'titleTooLong',
  taskRequired: 'taskRequired',
  taskTooLong: 'taskTooLong',
  dateInvalid: 'dateInvalid',
  solutionTooLong: 'solutionTooLong',
} as const;

export type AssignmentCode =
  (typeof ASSIGNMENT_VALIDATION_CODES)[keyof typeof ASSIGNMENT_VALIDATION_CODES];

const CODES = ASSIGNMENT_VALIDATION_CODES;

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
