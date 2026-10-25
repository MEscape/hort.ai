import type { Actor } from '@modules/auth';

import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import type { RateLimiter, RateLimitPolicy, RateLimitRequest } from '@lib/rate-limit';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/guidance-errors';
import { GUIDANCE_RATE_LIMITS } from '../rate-limits';

import type { ChildProfileId } from '../../domain/models/ids';

/** The daily window that belongs to each ten-minute one. */
const DAILY_WINDOW_OF: ReadonlyMap<string, RateLimitPolicy> = new Map<string, RateLimitPolicy>([
  [GUIDANCE_RATE_LIMITS.hintRequest.id, GUIDANCE_RATE_LIMITS.hintRequestDaily],
  [GUIDANCE_RATE_LIMITS.answerCheck.id, GUIDANCE_RATE_LIMITS.answerCheckDaily],
  [GUIDANCE_RATE_LIMITS.sessionStart.id, GUIDANCE_RATE_LIMITS.sessionStartDaily],
]);

/**
 * Spends one of the child's budget under `policy`, its daily window, the parent account's hourly
 * budget and the global hourly budget for AI calls. Counted per child profile first, so siblings
 * working at the same time do not use up each other's help; then per account, so one account with
 * many profiles is refused before the global budget is counted and cannot use it up for everyone.
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
  const child = {
    kind: 'identifier',
    value: `child-profile:${actor.tenantId}:${childProfileId}`,
  } as const;
  const daily = DAILY_WINDOW_OF.get(policy.id);
  const requests: RateLimitRequest[] = [
    { policy, subject: child },
    ...(daily === undefined ? [] : [{ policy: daily, subject: child }]),
    {
      policy: GUIDANCE_RATE_LIMITS.aiCallsPerAccountHourly,
      subject: { kind: 'identifier', value: `account:${actor.tenantId}:${actor.id}` },
    },
    { policy: GUIDANCE_RATE_LIMITS.aiCallsHourly, subject: { kind: 'global' } },
  ];
  return rateLimiter
    .enforceAll(requests)
    .mapErr(fromRateLimitFailure)
    .map(() => undefined);
}
