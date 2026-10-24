'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { learnerCommands } from '../../composition';
import { toChildProfileDto } from '../dto/child-profile-dto';
import { learnerRoutes } from '../routes';
import { childProfileEditSchema } from '../schemas/child-profile-edit-schema';
import { parseLearnerInput } from '../schemas/parse-learner-input';

import type { ChildProfileDto } from '../dto/child-profile-dto';

/** @keep Server Action for the parent child-profile screens; the UI lands with the parent dashboard (#12). */
export async function updateChildProfileAction(
  input: unknown,
): Promise<ActionResult<ChildProfileDto>> {
  const result = await parseLearnerInput(childProfileEditSchema, input).asyncAndThen((command) =>
    learnerCommands.updateChildProfile.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(learnerRoutes.list());
    revalidatePath(learnerRoutes.detail(result.value.id));
  }
  return toActionResult(result.map(toChildProfileDto));
}
