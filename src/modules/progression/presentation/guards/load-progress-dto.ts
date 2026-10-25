import 'server-only';

import { getProgressionQueries } from '../../composition';
import { toProgressDto } from '../dto/progress-dto';

import type { ProgressDto } from '../dto/progress-dto';

/**
 * For pages: the child's progress, read from the backend. A failure is unexpected and is thrown, so
 * it reaches `error.tsx` instead of being shown as "no progress yet". The query authorizes itself
 * and answers for the signed-in parent's own child only.
 */
export async function loadProgressDto(childProfileId: string): Promise<ProgressDto> {
  const result = await getProgressionQueries().getProgress.execute({ childProfileId });
  if (result.isErr()) {
    throw new Error(result.error.code, { cause: result.error });
  }
  return toProgressDto(result.value);
}
