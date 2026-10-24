'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { learnerCommands } from '../../composition';
import { toChildProfileDto } from '../dto/child-profile-dto';
import { learnerRoutes } from '../routes';
import { newChildProfileSchema } from '../schemas/new-child-profile-schema';
import { parseLearnerInput } from '../schemas/parse-learner-input';

import type { ChildProfileDto } from '../dto/child-profile-dto';

export async function createChildProfileAction(
  input: unknown,
): Promise<ActionResult<ChildProfileDto>> {
  const result = await parseLearnerInput(newChildProfileSchema, input).asyncAndThen((command) =>
    learnerCommands.createChildProfile.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(learnerRoutes.list());
  }
  return toActionResult(result.map(toChildProfileDto));
}
