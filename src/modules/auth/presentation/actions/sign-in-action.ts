'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { resolveReturnPath } from '../navigation/return-path';
import { ROOT_LAYOUT_PATH } from '../routes';
import { parseAuthInput } from '../schemas/parse-auth-input';
import { signInActionSchema } from '../schemas/sign-in-schema';

import type { SignInDto } from '../dto/auth-dto';

/**
 * Framework adapter: validate, call the use case, invalidate. Sign-in is
 * the one flow that is unauthenticated by nature; the use case rate-limits
 * it instead. `returnTo` is resolved here, so the browser only ever gets
 * back a same-site path.
 */
export async function signInAction(input: unknown): Promise<ActionResult<SignInDto>> {
  const result = await parseAuthInput(signInActionSchema, input).asyncAndThen(
    ({ returnTo, ...credentials }) =>
      getAuthCommands()
        .signIn.execute(credentials)
        .map((): SignInDto => ({ redirectTo: resolveReturnPath(returnTo) })),
  );

  if (result.isOk()) {
    revalidatePath(ROOT_LAYOUT_PATH, 'layout');
  }
  return toActionResult(result);
}
