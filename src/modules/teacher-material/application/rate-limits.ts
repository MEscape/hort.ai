import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_HOUR } from '@lib/utils';

/** Thirty files/hour bounds storage and CPU; cleanup remains available when uploads exhaust it. */
export const MATERIAL_RATE_LIMITS = {
  upload: {
    id: 'teacher-material.upload',
    limit: 30,
    windowSeconds: SECONDS_PER_HOUR,
    onBackendFailure: 'deny',
  },
  complete: {
    id: 'teacher-material.complete',
    limit: 60,
    windowSeconds: SECONDS_PER_HOUR,
    onBackendFailure: 'deny',
  },
  delete: {
    id: 'teacher-material.delete',
    limit: 120,
    windowSeconds: SECONDS_PER_HOUR,
    onBackendFailure: 'deny',
  },
} as const satisfies Record<string, RateLimitPolicy>;
