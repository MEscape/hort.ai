import { describe, expect, it } from 'vitest';

import type { RateLimitPolicy, RateLimitRequest } from '@lib/rate-limit';
import { createDisabledRateLimiter } from '@lib/rate-limit/disabled-rate-limiter';

import { createRecordingLog } from './fakes';

const policy: RateLimitPolicy = {
  id: 'auth.sign-in',
  limit: 2,
  windowSeconds: 60,
  onBackendFailure: 'deny',
};
const request: RateLimitRequest = { policy, subject: { kind: 'global' } };

describe('createDisabledRateLimiter', () => {
  it('allows every attempt without counting', async () => {
    const limiter = createDisabledRateLimiter(createRecordingLog());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const allowed = await limiter.enforce(request);
      expect(allowed._unsafeUnwrap()).toEqual({
        limit: 2,
        remaining: null,
        resetAfterSeconds: null,
        degraded: false,
      });
    }
  });

  it('answers enforceAll with one allowance per request, in order', async () => {
    const limiter = createDisabledRateLimiter(createRecordingLog());
    const other: RateLimitRequest = {
      policy: { ...policy, id: 'auth.sign-up', limit: 9 },
      subject: request.subject,
    };

    const allowed = (await limiter.enforceAll([request, other]))._unsafeUnwrap();

    expect(allowed.map((allowance) => allowance.limit)).toEqual([2, 9]);
  });

  it('says it is off once, however often it is asked', async () => {
    const log = createRecordingLog();
    const limiter = createDisabledRateLimiter(log);

    await limiter.enforce(request);
    await limiter.enforceAll([request]);
    await limiter.enforce(request);

    expect(log.entries.filter((entry) => entry.message === 'rate_limit.disabled')).toHaveLength(1);
    expect(log.entries[0]?.level).toBe('warn');
  });
});
