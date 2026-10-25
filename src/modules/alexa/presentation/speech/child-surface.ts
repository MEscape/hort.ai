import { z } from 'zod';

import type { SessionAttributes } from './alexa-speech';
import type { DialogSurface, PendingStep } from './child-dialog';
import type { TutorId, TutorIntroduction } from '../../application/contracts/tutor-voice-model';

const MAX_REMEMBERED_PARTS = 8;
export const MAX_PART_LENGTH = 600;
const REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/u;

const partSchema = z.object({
  kind: z.enum(['line', 'alexa']),
  text: z.string().max(MAX_PART_LENGTH),
});
/**
 * Surface state only (rule 10): the open yes/no question, the last reply for "Wiederholen", and whose
 * voice spoke it, so a turn without a use case keeps that voice without asking the database. For the
 * help session only whether the last reply was part of it, asked for a task, or left a step running;
 * the session itself stays in the backend.
 */
const surfaceSchema = z.object({
  question: z.literal('feed').nullable().optional(),
  last: z.array(partSchema).max(MAX_REMEMBERED_PARTS).optional(),
  speaker: z.string().max(MAX_PART_LENGTH).optional(),
  learning: z.boolean().optional(),
  expectTask: z.boolean().optional(),
  pending: z
    .object({
      op: z.enum(['start', 'pick', 'hint', 'check', 'reply']),
      requestId: z.string().regex(REQUEST_ID),
      text: z.string().max(MAX_PART_LENGTH),
    })
    .nullable()
    .optional(),
});

export interface Surface {
  readonly surface: DialogSurface;
  readonly speaker: TutorId | null;
  readonly learning: boolean;
  readonly expectTask: boolean;
  readonly pending: PendingStep | null;
}

/** The surface state of the previous reply; anything malformed is ignored as a whole. */
export function readSurface(
  attributes: SessionAttributes | undefined,
  introductions: readonly TutorIntroduction[],
): Surface {
  const parsed = surfaceSchema.safeParse(attributes ?? {});
  if (!parsed.success) {
    return {
      surface: { question: null, last: [] },
      speaker: null,
      learning: false,
      expectTask: false,
      pending: null,
    };
  }
  const { question, last, speaker, learning, expectTask, pending } = parsed.data;
  // Only a ready catalog tutor is a voice; anything else in the attributes is ignored.
  const known = introductions.find((intro) => intro.tutorId === speaker)?.tutorId ?? null;
  return {
    surface: { question: question ?? null, last: last ?? [] },
    speaker: known,
    learning: learning === true,
    expectTask: expectTask === true,
    pending: pending ?? null,
  };
}
