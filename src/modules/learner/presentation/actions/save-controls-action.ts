'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getLearnerCommands } from '../../composition';
import { toChildProfileDto } from '../dto/learner-dto';
import { NO_LIMIT, saveControlsActionSchema } from '../schemas/onboarding-schema';
import { parseLearnerInput } from '../schemas/parse-learner-input';

import type { ChildProfileDto } from '../dto/learner-dto';

/**
 * Framework adapter: validate, then call the use case, which authorizes the signed-in parent and
 * checks that the profile is theirs. Success means the backend stored it.
 */
export async function saveControlsAction(input: unknown): Promise<ActionResult<ChildProfileDto>> {
  const result = await parseLearnerInput(saveControlsActionSchema, input).asyncAndThen((values) =>
    getLearnerCommands()
      .saveControls.execute({
        profileId: values.profileId,
        voiceEnabled: values.voiceEnabled,
        voiceNoticeVersion: values.voiceNoticeVersion,
        dailyLimitMinutes:
          values.dailyLimitMinutes === NO_LIMIT ? null : Number(values.dailyLimitMinutes),
        allowedWindow: values.windowEnabled
          ? { fromMinute: Number(values.windowFrom), untilMinute: Number(values.windowUntil) }
          : null,
        learningInsights: values.learningInsights,
        guardianConfirmed: true,
      })
      .map(toChildProfileDto),
  );
  return toActionResult(result);
}
