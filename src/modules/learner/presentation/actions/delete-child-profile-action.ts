'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { learnerCommands } from '../../composition';
import { learnerRoutes } from '../routes';
import { deleteChildProfileSchema } from '../schemas/delete-child-profile-schema';
import { parseLearnerInput } from '../schemas/parse-learner-input';

/** @keep Server Action for the parent child-profile screens; the UI lands with the parent dashboard (#12). */
export async function deleteChildProfileAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseLearnerInput(deleteChildProfileSchema, input).asyncAndThen((command) =>
    learnerCommands.deleteChildProfile.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(learnerRoutes.list());
  }
  return toActionResult(result);
}
