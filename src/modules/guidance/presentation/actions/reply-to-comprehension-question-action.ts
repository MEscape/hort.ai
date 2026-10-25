'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getHelpSessionCommands } from '../../composition';
import { toComprehensionReplyDto } from '../dto/help-session-dto';
import { replyToComprehensionQuestionSchema } from '../schemas/guidance-schema';
import { parseGuidanceInput } from '../schemas/parse-guidance-input';

import type { ComprehensionReplyDto } from '../dto/help-session-dto';

/**
 * Framework adapter for the child's reply to the comprehension question (#78). The backend decides
 * whether the task is understood; the browser never sends it.
 */
export async function replyToComprehensionQuestionAction(
  input: unknown,
): Promise<ActionResult<ComprehensionReplyDto>> {
  const result = await parseGuidanceInput(replyToComprehensionQuestionSchema, input).asyncAndThen(
    (values) =>
      getHelpSessionCommands()
        .replyToComprehensionQuestion.execute(values)
        .map(toComprehensionReplyDto),
  );
  return toActionResult(result);
}
