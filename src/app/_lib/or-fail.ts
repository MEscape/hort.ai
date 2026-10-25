import { notFound } from 'next/navigation';

import { authRoutes } from '@modules/auth';

import { redirect } from '@i18n';

import { getLocale } from '@i18n/server';

import { matchAppError } from '@lib/errors';
import type { AppError } from '@lib/errors';
import { escalate } from '@lib/errors/escalate';
import type { AppResult } from '@lib/result';

/**
 * The value of a use-case result, or the route's failure. Not found, forbidden,
 * invalid ids and conflicts all look the same on purpose: a route must not
 * disclose whether a resource exists in another tenant. A lost session goes to
 * sign-in in the visitor's language; everything else reaches `error.tsx`.
 * Pages call this instead of each choosing their own error handling.
 */
export async function orFail<T, E extends AppError>(
  pending: AppResult<T, E> | PromiseLike<AppResult<T, E>>,
): Promise<T> {
  const result = await pending;
  if (result.isOk()) {
    return result.value;
  }
  const locale = await getLocale();
  return matchAppError(result.error, {
    validation: () => notFound(),
    not_found: () => notFound(),
    forbidden: () => notFound(),
    conflict: () => notFound(),
    rate_limited: (cause) => escalate(cause),
    unauthorized: () => redirect({ href: authRoutes.signIn(), locale }),
    infrastructure: (cause) => escalate(cause),
    unexpected: (cause) => escalate(cause),
  });
}
