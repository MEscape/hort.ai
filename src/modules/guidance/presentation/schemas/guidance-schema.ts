import { z } from 'zod';

import {
  CHILD_INPUT_VALIDATION_CODES,
  CHILD_TASK_TEXT_MAX_LENGTH,
  GUIDANCE_ID_MAX_LENGTH,
  GUIDANCE_VALIDATION_CODES as CODES,
} from '../../application/contracts/guidance-constraints';

/**
 * Action input schemas. Messages are stable codes, never prose: the UI translates them (i18n.md).
 * They only shape and bound the input; the use case checks every rule again. Unknown keys (a task on a
 * step, a level, a status, a tenant) are dropped, so the client cannot choose what the session decides.
 */
const idSchema = (message: string) =>
  z.string({ message }).min(1, { message }).max(GUIDANCE_ID_MAX_LENGTH, { message });

/** Counted in characters by the domain; a string of code units can be up to twice as long. */
const CHILD_TEXT_INPUT_MAX = CHILD_TASK_TEXT_MAX_LENGTH * 2;

/** Longer than any subject; the use case checks it against `HINT_SUBJECTS`. */
const SUBJECT_INPUT_MAX = 32;

const childTextSchema = z
  .string({ message: CHILD_INPUT_VALIDATION_CODES.empty })
  .max(CHILD_TEXT_INPUT_MAX, { message: CHILD_INPUT_VALIDATION_CODES.tooLong });

export const requestHintSchema = z.object({
  childProfileId: idSchema(CODES.childProfileIdInvalid),
  sessionId: idSchema(CODES.sessionIdInvalid),
  requestId: idSchema(CODES.requestIdInvalid),
});

export const checkAnswerSchema = requestHintSchema.extend({
  answer: childTextSchema,
});

export const getOpenHelpSessionSchema = z.object({
  childProfileId: idSchema(CODES.childProfileIdInvalid),
});

/** `task` is the child's own text; `assignmentId` a teacher's assignment of the child's class (#33). */
export const startHelpSessionSchema = getOpenHelpSessionSchema.extend({
  task: childTextSchema.optional(),
  assignmentId: idSchema(CODES.assignmentIdInvalid).optional(),
  subject: z
    .string({ message: CODES.subjectInvalid })
    .max(SUBJECT_INPUT_MAX, { message: CODES.subjectInvalid }),
});

export const replyComprehensionSchema = getOpenHelpSessionSchema.extend({
  sessionId: idSchema(CODES.sessionIdInvalid),
  reply: childTextSchema,
});
