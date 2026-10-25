'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getVoiceQueries } from '../../composition';
import { parseVoiceInput } from '../schemas/parse-voice-input';
import { readAloudSchema } from '../schemas/read-aloud-schema';
import { predefinedWording } from '../services/predefined-wording';

/** What the browser posts to `/api/voice/speech` to hear the message. */
export interface ReadAloudTicketDto {
  readonly ticket: string;
  readonly speakerId: string;
}

/**
 * Framework adapter for "Vorlesen" (#34): validate, then call the use case, which authorizes the
 * signed-in parent, checks the child is theirs and allows speech, and reads the message's words
 * on the server. The input names a message, never words; predefined lines are worded from the
 * guidance catalog in the request's language, as the child reads them.
 */
export async function readAloudAction(input: unknown): Promise<ActionResult<ReadAloudTicketDto>> {
  const wording = await predefinedWording();
  const result = await parseVoiceInput(readAloudSchema, input).asyncAndThen((values) =>
    getVoiceQueries().issueReadAloudTicket.execute({
      ...values,
      wording,
    }),
  );
  return toActionResult(result);
}
