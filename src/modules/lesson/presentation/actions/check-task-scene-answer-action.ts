'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getLessonQueries } from '../../composition';
import { toSceneAnswerDto } from '../dto/lesson-dto';
import { checkTaskSceneAnswerActionSchema } from '../schemas/lesson-schema';
import { parseLessonInput } from '../schemas/parse-lesson-input';

import type { SceneAnswerDto } from '../dto/lesson-dto';

/**
 * Framework adapter: validate the scene event, then the use case authorizes the signed-in parent,
 * plans the open task's scene again on the server and judges the answer there.
 */
export async function checkTaskSceneAnswerAction(
  input: unknown,
): Promise<ActionResult<SceneAnswerDto>> {
  const result = await parseLessonInput(checkTaskSceneAnswerActionSchema, input).asyncAndThen(
    (values) => getLessonQueries().checkTaskSceneAnswer.execute(values).map(toSceneAnswerDto),
  );
  return toActionResult(result);
}
