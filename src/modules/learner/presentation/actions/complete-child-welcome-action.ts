'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getLearnerCommands } from '../../composition';
import { toChildProfileDto } from '../dto/learner-dto';
import { completeSetupActionSchema } from '../schemas/onboarding-schema';
import { parseLearnerInput } from '../schemas/parse-learner-input';

import type { ChildProfileDto } from '../dto/learner-dto';

/**
 * Framework adapter for the child's welcome: validate, then call the use case, which authorizes the
 * signed-in parent and checks that the profile is theirs. Success means the backend stored it.
 */
export async function completeChildWelcomeAction(
  input: unknown,
): Promise<ActionResult<ChildProfileDto>> {
  const result = await parseLearnerInput(completeSetupActionSchema, input).asyncAndThen(
    ({ profileId }) =>
      getLearnerCommands().completeChildWelcome.execute({ profileId }).map(toChildProfileDto),
  );
  return toActionResult(result);
}
