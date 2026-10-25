'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { displayNameSchema } from '../schemas/account-schema';
import { parseAuthInput } from '../schemas/parse-auth-input';

/** Renames the signed-in person; the use case authorizes and accepts the name alone. */
export async function updateDisplayNameAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseAuthInput(displayNameSchema, input).asyncAndThen((command) =>
    getAuthCommands().updateDisplayName.execute(command),
  );
  return toActionResult(result);
}
