import 'server-only';

import { getLessonQueries } from '../../composition';
import { toLessonDto } from '../dto/lesson-dto';

import type { LessonDto } from '../dto/lesson-dto';

/**
 * For pages: a lesson's scenes for the signed-in parent's own child. A failure is unexpected and is
 * thrown, so it reaches `error.tsx`; the query authorizes itself.
 */
export async function loadLessonDto(childProfileId: string, lessonId: string): Promise<LessonDto> {
  const result = await getLessonQueries().getLesson.execute({ childProfileId, lessonId });
  if (result.isErr()) {
    throw new Error(result.error.code, { cause: result.error });
  }
  return toLessonDto(result.value);
}
