'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getHelpSessionCommands } from '../../composition';
import { toStartHelpSessionDto } from '../dto/help-session-dto';
import { startHelpSessionSchema } from '../schemas/guidance-schema';
import { parseGuidanceInput } from '../schemas/parse-guidance-input';

import type { StartHelpSessionDto } from '../dto/help-session-dto';

/**
 * Framework adapter for "I have a task" (#83): check the shape, then the use case authorizes the
 * signed-in parent, checks the child is theirs and stores the session. The same open task again
 * continues it.
 */
export async function startHelpSessionAction(
  input: unknown,
): Promise<ActionResult<StartHelpSessionDto>> {
  const result = await parseGuidanceInput(startHelpSessionSchema, input).asyncAndThen((values) =>
    getHelpSessionCommands().startHelpSession.execute(values).map(toStartHelpSessionDto),
  );
  return toActionResult(result);
}
