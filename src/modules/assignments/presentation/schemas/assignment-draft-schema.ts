import { z } from 'zod';

/** UI-only bounds until the assignment creation contract exists (issue #33). */
export const ASSIGNMENT_DRAFT_LIMITS = { title: 120, taskText: 4000, solutionKey: 4000 } as const;
const calendarDateSchema = z.iso.date();

/** Local preview validation; future Server Actions must validate again at their own boundary. */
export const assignmentDraftSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'titleRequired')
    .max(ASSIGNMENT_DRAFT_LIMITS.title, 'titleTooLong'),
  taskText: z
    .string()
    .trim()
    .min(1, 'taskRequired')
    .max(ASSIGNMENT_DRAFT_LIMITS.taskText, 'taskTooLong'),
  dueDate: z
    .string()
    .refine((value) => value === '' || calendarDateSchema.safeParse(value).success, 'dateInvalid'),
  solutionKey: z.string().trim().max(ASSIGNMENT_DRAFT_LIMITS.solutionKey, 'solutionTooLong'),
});

export type AssignmentDraft = z.infer<typeof assignmentDraftSchema>;
