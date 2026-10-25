import { z } from 'zod';

import { READ_ALOUD_FEEDBACK } from '../../application/contracts/voice-constraints';

/** More hints than any help session holds; bounds the index only. */
const MAX_HINT_INDEX = 99;
/** The learner module issues ids of at most this length. */
const CHILD_PROFILE_ID_MAX_LENGTH = 128;

/**
 * Which companion message to read aloud: never its words. A hint by its place in the open help
 * session, the waiting comprehension question, or a fixed feedback line.
 */
export const readAloudSchema = z
  .object({
    childProfileId: z.string().min(1).max(CHILD_PROFILE_ID_MAX_LENGTH),
    message: z.discriminatedUnion('kind', [
      z
        .object({ kind: z.literal('hint'), index: z.number().int().min(0).max(MAX_HINT_INDEX) })
        .strict(),
      z.object({ kind: z.literal('question') }).strict(),
      z.object({ kind: z.literal('feedback'), feedback: z.enum(READ_ALOUD_FEEDBACK) }).strict(),
    ]),
  })
  .strict();
