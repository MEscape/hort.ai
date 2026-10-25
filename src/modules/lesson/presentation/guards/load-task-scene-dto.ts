import 'server-only';

import { getLessonQueries } from '../../composition';
import { toTaskSceneDto } from '../dto/lesson-dto';

import type { TaskSceneDto } from '../dto/lesson-dto';

/**
 * For pages: the scene for the child's open task, or `null` (no open task, or no math a template
 * can draw). A failure is unexpected and is thrown, so it reaches `error.tsx`.
 */
export async function loadTaskSceneDto(childProfileId: string): Promise<TaskSceneDto | null> {
  const result = await getLessonQueries().getTaskScene.execute({ childProfileId });
  if (result.isErr()) {
    throw new Error(result.error.code, { cause: result.error });
  }
  return result.value === null ? null : toTaskSceneDto(result.value);
}
