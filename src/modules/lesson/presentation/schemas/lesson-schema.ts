import { z } from 'zod';

import {
  COMPARE_CHOICES,
  FRACTION_LIMITS,
  GROUPS_LIMITS,
  LESSON_VALIDATION_CODES as CODES,
  MAX_ATTEMPT,
  TEXT_ANSWER_MAX_LENGTH,
} from '../../application/contracts/lesson-constraints';

const ID_MAX_LENGTH = 64;

const id = z
  .string()
  .min(1, { message: CODES.idInvalid })
  .max(ID_MAX_LENGTH, { message: CODES.idInvalid });

/** A scene event or typed text, from the closed union; unknown kinds and extra fields are rejected. */
const sceneAnswer = z.discriminatedUnion(
  'kind',
  [
    z.strictObject({ kind: z.literal('choose'), choice: z.enum(COMPARE_CHOICES) }),
    z.strictObject({
      kind: z.literal('fill'),
      laid: z.number().int().min(0).max(FRACTION_LIMITS.maxParts),
    }),
    z.strictObject({
      kind: z.literal('number'),
      value: z
        .number()
        .int()
        .min(0)
        .max(GROUPS_LIMITS.maxGroups * GROUPS_LIMITS.maxEach),
    }),
    z.strictObject({
      kind: z.literal('text'),
      message: z.string().trim().min(1).max(TEXT_ANSWER_MAX_LENGTH),
    }),
  ],
  { message: CODES.answerInvalid },
);

/** One answer to one step. The child's owner never travels; the server reads it from the session. */
export const checkSceneAnswerActionSchema = z.strictObject({
  childProfileId: id,
  lessonId: id,
  stepId: id,
  attempt: z.number().int().min(1).max(MAX_ATTEMPT),
  answer: sceneAnswer,
});

/** One answer to the scene of the child's open task; the session must still be the open one. */
export const checkTaskSceneAnswerActionSchema = z.strictObject({
  childProfileId: id,
  sessionId: id,
  attempt: z.number().int().min(1).max(MAX_ATTEMPT),
  answer: sceneAnswer,
});
