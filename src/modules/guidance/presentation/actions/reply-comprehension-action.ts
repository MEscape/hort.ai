'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getHelpSessionCommands } from '../../composition';
import { toComprehensionReplyDto } from '../dto/guidance-dto';
import { replyComprehensionSchema } from '../schemas/guidance-schema';
import { parseGuidanceInput } from '../schemas/parse-guidance-input';

import type { ComprehensionReplyDto } from '../dto/guidance-dto';

/**
 * Framework adapter: validate, then call the use case, which authorizes the signed-in parent,
 * checks that the child and the session are theirs and stores the reply once. Whether the task is
 * now understood is decided from the stored answer check; a `status` sent by the client is dropped.
 * No budget of its own: a question follows only a checked answer, which spends the check budget.
 *
 * @keep Server Action for the child's help screen, wired by the learner UI work (#83).
 */
export async function replyComprehensionAction(
  input: unknown,
): Promise<ActionResult<ComprehensionReplyDto>> {
  const result = await parseGuidanceInput(replyComprehensionSchema, input).asyncAndThen((values) =>
    getHelpSessionCommands()
      .replyToComprehensionQuestion.execute(values)
      .map(toComprehensionReplyDto),
  );
  return toActionResult(result);
}
