'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { parseAuthInput } from '../schemas/parse-auth-input';
import { resetPasswordActionSchema } from '../schemas/reset-password-schema';

export async function resetPasswordAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseAuthInput(resetPasswordActionSchema, input).asyncAndThen((command) =>
    getAuthCommands().resetPassword.execute(command),
  );

  return toActionResult(result);
}
