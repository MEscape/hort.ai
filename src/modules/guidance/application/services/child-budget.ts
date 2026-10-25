import type { Actor } from '@modules/auth';

import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import type { RateLimiter, RateLimitPolicy } from '@lib/rate-limit';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/guidance-errors';

import type { ChildProfileId } from '../../domain/models/ids';

/**
 * Spends one of the child's budget under `policy`. Counted per child profile, not per parent, so
 * siblings working at the same time do not use up each other's help.
 */
export function spendChildBudget(
  rateLimiter: RateLimiter,
  {
    actor,
    childProfileId,
    policy,
  }: {
    readonly actor: Actor;
    readonly childProfileId: ChildProfileId;
    readonly policy: RateLimitPolicy;
  },
): AppResultAsync<void, RateLimitedAppError | InfrastructureAppError> {
  return rateLimiter
    .enforce({
      policy,
      subject: { kind: 'identifier', value: `child-profile:${actor.tenantId}:${childProfileId}` },
    })
    .mapErr(fromRateLimitFailure)
    .map(() => undefined);
}
