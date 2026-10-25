'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getLearnerCommands } from '../../composition';
import { toChildProfileDto } from '../dto/learner-dto';
import { setVoiceConsentActionSchema } from '../schemas/onboarding-schema';
import { parseLearnerInput } from '../schemas/parse-learner-input';

import type { ChildProfileDto } from '../dto/learner-dto';

/**
 * Framework adapter for the speech-to-text switch: validate, then call the use case, which
 * authorizes the signed-in parent, checks the profile is theirs and the notice version is current.
 */
export async function setVoiceConsentAction(
  input: unknown,
): Promise<ActionResult<ChildProfileDto>> {
  const result = await parseLearnerInput(setVoiceConsentActionSchema, input).asyncAndThen(
    (values) => getLearnerCommands().setVoiceConsent.execute(values).map(toChildProfileDto),
  );
  return toActionResult(result);
}
