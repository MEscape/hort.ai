'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getProgressionCommands } from '../../composition';
import { toClaimDailyRewardDto } from '../dto/progress-dto';
import { parseProgressionInput } from '../schemas/parse-progression-input';
import { claimDailyRewardActionSchema } from '../schemas/progression-schema';

import type { ClaimDailyRewardDto } from '../dto/progress-dto';

/**
 * Framework adapter: validate, then call the use case, which authorizes the signed-in parent and
 * checks that the child is theirs. Success means the backend stored the reward (`granted`) or had
 * it already (`already_claimed`); the browser reacts to that answer only.
 */
export async function claimDailyRewardAction(
  input: unknown,
): Promise<ActionResult<ClaimDailyRewardDto>> {
  const result = await parseProgressionInput(claimDailyRewardActionSchema, input).asyncAndThen(
    (values) =>
      getProgressionCommands().claimDailyReward.execute(values).map(toClaimDailyRewardDto),
  );
  return toActionResult(result);
}
