'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getLessonQueries } from '../../composition';
import { toSceneAnswerDto } from '../dto/lesson-dto';
import { checkSceneAnswerActionSchema } from '../schemas/lesson-schema';
import { parseLessonInput } from '../schemas/parse-lesson-input';

import type { SceneAnswerDto } from '../dto/lesson-dto';

/**
 * Framework adapter: validate the scene event, then the use case authorizes the signed-in parent,
 * checks the child is theirs and judges the answer on the server. The browser only reacts.
 */
export async function checkSceneAnswerAction(
  input: unknown,
): Promise<ActionResult<SceneAnswerDto>> {
  const result = await parseLessonInput(checkSceneAnswerActionSchema, input).asyncAndThen(
    (values) => getLessonQueries().checkSceneAnswer.execute(values).map(toSceneAnswerDto),
  );
  return toActionResult(result);
}
