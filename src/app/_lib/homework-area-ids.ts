import { getHelpSessionQueries } from '@modules/guidance';

import { logger } from '@lib/logger';

/**
 * For the world pages: the islands the child did homework on, which clears their mist. A failure
 * is logged and answers no record (`undefined`), which draws no mist at all, so a failed read never
 * hides an island or takes the page down.
 */
export async function loadHomeworkAreaIds(
  childProfileId: string,
): Promise<ReadonlySet<string> | undefined> {
  const result = await getHelpSessionQueries().getHomeworkAreaIds.execute({ childProfileId });
  if (result.isErr()) {
    logger.warn('world.homework_areas_unavailable', { code: result.error.code });
    return undefined;
  }
  return new Set(result.value);
}
