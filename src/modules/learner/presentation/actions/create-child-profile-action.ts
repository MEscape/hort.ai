'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getLearnerCommands } from '../../composition';
import { toChildProfileDto } from '../dto/learner-dto';
import { childProfileSchema } from '../schemas/child-profile-schema';
import { parseLearnerInput } from '../schemas/parse-learner-input';

import type { ChildProfileDto } from '../dto/learner-dto';

/**
 * Framework adapter: validate, then call the use case, which authorizes the signed-in parent. A
 * second submit of the same form corrects the parent's unfinished profile instead of adding one.
 */
export async function createChildProfileAction(
  input: unknown,
): Promise<ActionResult<ChildProfileDto>> {
  const result = await parseLearnerInput(childProfileSchema, input).asyncAndThen((values) =>
    getLearnerCommands()
      .createChildProfile.execute({ ...values, grade: Number(values.grade) })
      .map(toChildProfileDto),
  );

  return toActionResult(result);
}
