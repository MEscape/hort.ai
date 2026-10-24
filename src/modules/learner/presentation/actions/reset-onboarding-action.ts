'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getLearnerCommands } from '../../composition';

/**
 * Framework adapter for the development reset: no input, because the use case acts on the signed-in
 * parent only and refuses in production. Success means the parent's profiles are gone.
 */
export async function resetOnboardingAction(): Promise<ActionResult<{ readonly deleted: number }>> {
  const result = await getLearnerCommands()
    .resetOnboarding.execute()
    .map((deleted) => ({ deleted }));
  return toActionResult(result);
}
