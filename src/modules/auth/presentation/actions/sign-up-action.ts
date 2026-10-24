'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { parseAuthInput } from '../schemas/parse-auth-input';
import { signUpSchema } from '../schemas/sign-up-schema';

/**
 * Framework adapter: validate, then call the use case. Sign-up is unauthenticated by nature; the
 * use case rate-limits it instead. It succeeds whether or not the address already has an account
 * (enumeration protection), so the form shows one confirmation either way.
 */
export async function signUpAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseAuthInput(signUpSchema, input).asyncAndThen(
    ({ name, email, password }) => getAuthCommands().signUp.execute({ name, email, password }),
  );

  return toActionResult(result);
}
