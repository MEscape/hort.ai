'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getParentAreaServices } from '../../composition';
import { ROOT_LAYOUT_PATH } from '../routes';

/** Revoke the temporary parent permission before handing the device back. */
export async function closeParentAreaAction(): Promise<ActionResult<void>> {
  const result = await getParentAreaServices().close.execute();
  if (result.isOk()) {
    revalidatePath(ROOT_LAYOUT_PATH, 'layout');
  }
  return toActionResult(result);
}
