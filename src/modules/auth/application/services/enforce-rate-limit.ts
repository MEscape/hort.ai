import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import type { RateLimitPolicy, RateLimitRequest, ClientSubject } from '@lib/rate-limit';
import { ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/auth-errors';

import type { AuthenticationDependencies } from '../auth-dependencies';

export type RateLimitError = RateLimitedAppError | InfrastructureAppError;

type RateLimitDependencies = Pick<AuthenticationDependencies, 'rateLimiter' | 'clientAddress'>;

function enforce(
  deps: RateLimitDependencies,
  requestsFor: (client: ClientSubject) => readonly RateLimitRequest[],
): AppResultAsync<void, RateLimitError> {
  return ResultAsync.fromSafePromise(deps.clientAddress.current())
    .andThen((client) => deps.rateLimiter.enforceAll(requestsFor(client)))
    .map(() => undefined)
    .mapErr(fromRateLimitFailure);
}

/**
 * Counts one attempt against the caller's address and refuses it when that budget is used up.
 * Fails closed or open as the policy says; a refusal is the module's own `rateLimited` error.
 */
export function enforceClientLimit(
  deps: RateLimitDependencies,
  policy: RateLimitPolicy,
): AppResultAsync<void, RateLimitError> {
  return enforce(deps, (client) => [{ policy, subject: client }]);
}

/**
 * Counts one attempt against the caller's address and then against the account it names (a
 * normalised email). The address comes first, so one client cannot use up more of a victim's
 * account budget than its own address budget allows.
 */
export function enforceClientAndAccountLimits(
  deps: RateLimitDependencies,
  policies: { readonly client: RateLimitPolicy; readonly account: RateLimitPolicy },
  email: string,
): AppResultAsync<void, RateLimitError> {
  return enforce(deps, (client) => [
    { policy: policies.client, subject: client },
    { policy: policies.account, subject: { kind: 'identifier', value: email } },
  ]);
}
