'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { parseAuthInput } from '../schemas/parse-auth-input';
import { requestPasswordResetSchema } from '../schemas/request-password-reset-schema';

/** Succeeds whether or not the address has an account (enumeration protection). */
export async function requestPasswordResetAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseAuthInput(requestPasswordResetSchema, input).asyncAndThen((command) =>
    getAuthCommands().requestPasswordReset.execute(command),
  );

  return toActionResult(result);
}
