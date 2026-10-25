'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { passwordChangeSchema } from '../schemas/account-schema';
import { parseAuthInput } from '../schemas/parse-auth-input';

/** Changes the signed-in person's password; the provider checks the current one. */
export async function changePasswordAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseAuthInput(passwordChangeSchema, input).asyncAndThen((command) =>
    getAuthCommands().changePassword.execute(command),
  );
  return toActionResult(result);
}
