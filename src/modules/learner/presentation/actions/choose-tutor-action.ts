'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getLearnerCommands } from '../../composition';
import { toChildProfileDto } from '../dto/learner-dto';
import { chooseTutorActionSchema } from '../schemas/onboarding-schema';
import { parseLearnerInput } from '../schemas/parse-learner-input';

import type { ChildProfileDto } from '../dto/learner-dto';

/**
 * Framework adapter: validate, then call the use case, which authorizes the signed-in parent and
 * checks that the profile is theirs. Success means the backend stored it.
 */
export async function chooseTutorAction(input: unknown): Promise<ActionResult<ChildProfileDto>> {
  const result = await parseLearnerInput(chooseTutorActionSchema, input).asyncAndThen((values) =>
    getLearnerCommands().chooseTutor.execute(values).map(toChildProfileDto),
  );
  return toActionResult(result);
}
