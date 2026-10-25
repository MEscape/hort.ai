'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getGuidanceCommands } from '../../composition';
import { toHintDto } from '../dto/guidance-dto';
import { requestHintSchema } from '../schemas/guidance-schema';
import { parseGuidanceInput } from '../schemas/parse-guidance-input';

import type { HintDto } from '../dto/guidance-dto';

/**
 * Framework adapter: validate, then call the use case, which authorizes the signed-in parent,
 * checks that the child and the session are theirs, and lets the hint ladder pick the level from
 * the stored session. The browser never sends a level or the task. A rejected AI answer is still a
 * success (a `fallback` hint); errors are only for access, input, budget and storage.
 *
 * @keep Server Action for the child's help screen, wired by the learner UI work (#30).
 */
export async function requestHintAction(input: unknown): Promise<ActionResult<HintDto>> {
  const result = await parseGuidanceInput(requestHintSchema, input).asyncAndThen((values) =>
    getGuidanceCommands()
      .requestHint.execute(values)
      .map((step) => toHintDto(values.sessionId, step)),
  );
  return toActionResult(result);
}
