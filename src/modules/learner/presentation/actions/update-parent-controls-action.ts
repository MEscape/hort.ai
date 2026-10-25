'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getParentLearnerServices } from '../../composition';
import { toChildProfileDto } from '../dto/learner-dto';
import { ROOT_LAYOUT_PATH } from '../routes';
import { NO_LIMIT } from '../schemas/onboarding-schema';
import { updateParentControlsSchema } from '../schemas/parent-controls-schema';
import { parseLearnerInput } from '../schemas/parse-learner-input';

import type { ChildProfileDto } from '../dto/learner-dto';

/** Framework-only adapter; the command independently verifies parent access and stored ownership. */
export async function updateParentControlsAction(
  input: unknown,
): Promise<ActionResult<ChildProfileDto>> {
  const result = await parseLearnerInput(updateParentControlsSchema, input).asyncAndThen((values) =>
    getParentLearnerServices()
      .updateControls.execute({
        profileId: values.profileId,
        dailyLimitMinutes:
          values.dailyLimitMinutes === NO_LIMIT ? null : Number(values.dailyLimitMinutes),
        allowedWindow: values.windowEnabled
          ? { fromMinute: Number(values.windowFrom), untilMinute: Number(values.windowUntil) }
          : null,
        learningInsights: values.learningInsights,
      })
      .map(toChildProfileDto),
  );
  if (result.isOk()) {
    revalidatePath(ROOT_LAYOUT_PATH, 'layout');
  }
  return toActionResult(result);
}
