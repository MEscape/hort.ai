import { okAsync } from '@lib/result';

import type { RateLimitLog } from './rate-limit-log';
import type { RateLimitAllowance, RateLimiter, RateLimitRequest } from './rate-limiter';

function allowanceOf({ policy }: RateLimitRequest): RateLimitAllowance {
  return { limit: policy.limit, remaining: null, resetAfterSeconds: null, degraded: false };
}

/**
 * The limiter while `RATE_LIMIT_ENABLED=false`: nothing is counted, no store is reached, every
 * attempt is allowed. For development only, because production refuses the setting. It says so
 * once in the log, so a forgotten switch does not go unnoticed.
 *
 * Unlike the real limiter it does not validate policies or subjects: nothing is evaluated.
 */
export function createDisabledRateLimiter(log: RateLimitLog): RateLimiter {
  let hasWarned = false;
  const warnOnce = (): void => {
    if (!hasWarned) {
      hasWarned = true;
      log.warn('rate_limit.disabled', { reason: 'rate_limit_enabled_false' });
    }
  };

  return {
    enforce: (request) => {
      warnOnce();
      return okAsync(allowanceOf(request));
    },
    enforceAll: (requests) => {
      warnOnce();
      return okAsync(requests.map(allowanceOf));
    },
  };
}
