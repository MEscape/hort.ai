'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getHelpSessionCommands } from '../../composition';
import { toStartHelpSessionDto } from '../dto/guidance-dto';
import { startHelpSessionSchema } from '../schemas/guidance-schema';
import { parseGuidanceInput } from '../schemas/parse-guidance-input';

import type { StartHelpSessionDto } from '../dto/guidance-dto';

/**
 * Framework adapter: validate, then call the use case, which authorizes the signed-in parent,
 * checks that the child is theirs, spends the child's start budget and starts the session, or
 * continues the open one when it is the same task. The first hint is asked for separately.
 *
 * @keep Server Action for the child's help screen, wired by the learner UI work (#83).
 */
export async function startHelpSessionAction(
  input: unknown,
): Promise<ActionResult<StartHelpSessionDto>> {
  const result = await parseGuidanceInput(startHelpSessionSchema, input).asyncAndThen((values) =>
    getHelpSessionCommands().startHelpSession.execute(values).map(toStartHelpSessionDto),
  );
  return toActionResult(result);
}
