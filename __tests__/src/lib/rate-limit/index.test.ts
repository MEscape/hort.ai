import { describe, expect, it, vi } from 'vitest';

import * as rateLimit from '@lib/rate-limit';
import '@lib/rate-limit/client-address';
import '@lib/rate-limit/rate-limit-store';
import '@lib/rate-limit/rate-limiter';

// Importing the entry point must not read configuration or open a connection.
vi.mock('@lib/config/server', () => ({
  serverEnv: {},
  resolveRateLimitSettings: () => {
    throw new Error('configuration was read at import time');
  },
}));

describe('@lib/rate-limit', () => {
  it('exposes the public API', () => {
    expect(Object.keys(rateLimit).sort()).toEqual([
      'MAX_POLICY_ID_LENGTH',
      'MAX_POLICY_LIMIT',
      'MAX_POLICY_WINDOW_SECONDS',
      'MAX_SUBJECT_PART_LENGTH',
      'buildBucketKey',
      'createClientAddressProvider',
      'createClientAddressResolver',
      'createClientSubjectResolver',
      'createRateLimiter',
      'getClientAddressProvider',
      'getRateLimiter',
      'policyProblem',
    ]);
  });

  it('hands out a limiter and a provider without touching configuration', () => {
    expect(() => rateLimit.getRateLimiter()).not.toThrow();
    expect(() =>
      rateLimit.getClientAddressProvider(() => Promise.reject(new Error('x'))),
    ).not.toThrow();
  });
});
