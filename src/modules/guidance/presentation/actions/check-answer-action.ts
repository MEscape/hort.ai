'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getGuidanceCommands } from '../../composition';
import { toAnswerFeedbackDto } from '../dto/guidance-dto';
import { checkAnswerSchema } from '../schemas/guidance-schema';
import { parseGuidanceInput } from '../schemas/parse-guidance-input';

import type { AnswerFeedbackDto } from '../dto/guidance-dto';

/**
 * Framework adapter: validate, then call the use case, which authorizes the signed-in parent,
 * checks that the child and the session are theirs, assesses the answer against the session's task
 * and never states the solution. A failed AI assessment is still a success (`result: null`).
 *
 * @keep Server Action for the child's help screen, wired by the learner UI work (#14, #30).
 */
export async function checkAnswerAction(input: unknown): Promise<ActionResult<AnswerFeedbackDto>> {
  const result = await parseGuidanceInput(checkAnswerSchema, input).asyncAndThen((values) =>
    getGuidanceCommands()
      .checkAnswer.execute(values)
      .map((feedback) => toAnswerFeedbackDto(values.sessionId, feedback)),
  );
  return toActionResult(result);
}
