'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getHelpSessionQueries } from '../../composition';
import { toHelpSessionDto } from '../dto/guidance-dto';
import { getOpenHelpSessionSchema } from '../schemas/guidance-schema';
import { parseGuidanceInput } from '../schemas/parse-guidance-input';

import type { HelpSessionDto } from '../dto/guidance-dto';

/**
 * Framework adapter for "Continue": validate, then call the query, which authorizes the signed-in
 * parent, checks that the child is theirs and reads the open session from the server-side store
 * (`null` when there is none). Read-only, so it spends no budget.
 *
 * @keep Server Action for the child's help screen, wired by the learner UI work (#83).
 */
export async function getOpenHelpSessionAction(
  input: unknown,
): Promise<ActionResult<HelpSessionDto | null>> {
  const result = await parseGuidanceInput(getOpenHelpSessionSchema, input).asyncAndThen((values) =>
    getHelpSessionQueries()
      .getOpenHelpSession.execute(values)
      .map((open) => (open === null ? null : toHelpSessionDto(open))),
  );
  return toActionResult(result);
}
