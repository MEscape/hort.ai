'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getParentAreaServices } from '../../composition';
import { ROOT_LAYOUT_PATH } from '../routes';
import { parentAccessSchema } from '../schemas/parent-access-schema';
import { parseAuthInput } from '../schemas/parse-auth-input';

/** Verify the current account password, rate-limited by the application use case. */
export async function openParentAreaAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseAuthInput(parentAccessSchema, input).asyncAndThen(({ password }) =>
    getParentAreaServices().open.execute(password),
  );
  if (result.isOk()) {
    revalidatePath(ROOT_LAYOUT_PATH, 'layout');
  }
  return toActionResult(result);
}
