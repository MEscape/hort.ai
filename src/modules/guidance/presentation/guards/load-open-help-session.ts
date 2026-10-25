import 'server-only';

import { getHelpSessionQueries } from '../../composition';
import { toHelpSessionDto } from '../dto/guidance-dto';

import type { HelpSessionDto } from '../dto/guidance-dto';

/**
 * For pages ("Continue", #17): the child's open help session read from storage, or `null`. A
 * failure is unexpected and is thrown, so it reaches `error.tsx`. The query authorizes itself and
 * answers for the signed-in parent's own child only.
 */
export async function loadOpenHelpSession(childProfileId: string): Promise<HelpSessionDto | null> {
  const result = await getHelpSessionQueries().getOpenHelpSession.execute({ childProfileId });
  if (result.isErr()) {
    throw new Error(result.error.code, { cause: result.error });
  }
  return result.value === null ? null : toHelpSessionDto(result.value);
}
