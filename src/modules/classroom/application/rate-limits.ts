import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_HOUR } from '@lib/utils';

/**
 * Budgets for entering an invite code (#32): the brute-force protection of the code.
 *
 * A parent joins a class once per child and may mistype a few times, so ten attempts an hour per
 * parent is generous for a person and useless for guessing (about 36 bits per code). The address
 * budget comes first and bounds one client spreading attempts over many accounts; it is skipped
 * when the address cannot be determined, because the parent budget still applies.
 *
 * Both deny when the store is down: a guessing run is exactly what the limiter exists to stop.
 */
export const CLASSROOM_RATE_LIMITS = {
  joinByCode: {
    id: 'classroom.join-by-code',
    limit: 10,
    windowSeconds: SECONDS_PER_HOUR,
    onBackendFailure: 'deny',
  },
  joinByCodeClient: {
    id: 'classroom.join-by-code-client',
    limit: 30,
    windowSeconds: SECONDS_PER_HOUR,
    onBackendFailure: 'deny',
    onUnresolvedClient: 'skip',
  },
} as const satisfies Record<string, RateLimitPolicy>;
