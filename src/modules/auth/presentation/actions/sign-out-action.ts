'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { ROOT_LAYOUT_PATH } from '../routes';

export async function signOutAction(): Promise<ActionResult<void>> {
  const result = await getAuthCommands().signOut.execute();

  if (result.isOk()) {
    revalidatePath(ROOT_LAYOUT_PATH, 'layout');
  }
  return toActionResult(result);
}
