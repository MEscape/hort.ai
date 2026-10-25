import { z } from 'zod';

import {
  CHILD_INPUT_VALIDATION_CODES,
  CHILD_TASK_TEXT_MAX_LENGTH,
  GUIDANCE_ID_MAX_LENGTH,
  GUIDANCE_VALIDATION_CODES as CODES,
} from '../../application/contracts/guidance-constraints';

/**
 * Action input schemas. Messages are stable codes, never prose: the UI translates them (i18n.md).
 * They only shape and bound the input; the use case checks every rule again. Unknown keys (a task,
 * a level, a tenant) are dropped, so the client cannot choose what the session decides.
 */
const idSchema = (message: string) =>
  z.string({ message }).min(1, { message }).max(GUIDANCE_ID_MAX_LENGTH, { message });

/** Counted in characters by the domain; a string of code units can be up to twice as long. */
const ANSWER_INPUT_MAX = CHILD_TASK_TEXT_MAX_LENGTH * 2;

export const requestHintSchema = z.object({
  childProfileId: idSchema(CODES.childProfileIdInvalid),
  sessionId: idSchema(CODES.sessionIdInvalid),
  requestId: idSchema(CODES.requestIdInvalid),
});

export const checkAnswerSchema = requestHintSchema.extend({
  answer: z
    .string({ message: CHILD_INPUT_VALIDATION_CODES.empty })
    .max(ANSWER_INPUT_MAX, { message: CHILD_INPUT_VALIDATION_CODES.tooLong }),
});

const childTextSchema = z
  .string({ message: CHILD_INPUT_VALIDATION_CODES.empty })
  .max(ANSWER_INPUT_MAX, { message: CHILD_INPUT_VALIDATION_CODES.tooLong });

export const startHelpSessionSchema = z.object({
  childProfileId: idSchema(CODES.childProfileIdInvalid),
  task: childTextSchema,
  subject: z.string({ message: CODES.subjectInvalid }).max(GUIDANCE_ID_MAX_LENGTH, {
    message: CODES.subjectInvalid,
  }),
});

export const replyToComprehensionQuestionSchema = z.object({
  childProfileId: idSchema(CODES.childProfileIdInvalid),
  sessionId: idSchema(CODES.sessionIdInvalid),
  reply: childTextSchema,
});
