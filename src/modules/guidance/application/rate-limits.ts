import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_MINUTE } from '@lib/utils';

const HINT_REQUEST_WINDOW_MINUTES = 10;

/**
 * Budgets for asking the AI companion (#11).
 *
 * Counted per child profile, not per parent: siblings work at the same time and must not use up
 * each other's help. Twenty hints in ten minutes is far more than a child working through
 * homework asks for, but stops a stuck loop or a script from running up AI costs. Every request
 * calls an external system, so the budget denies when the store is down.
 */
export const GUIDANCE_RATE_LIMITS = {
  hintRequest: {
    id: 'guidance.hint-request',
    limit: 20,
    windowSeconds: HINT_REQUEST_WINDOW_MINUTES * SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
} as const satisfies Record<string, RateLimitPolicy>;
