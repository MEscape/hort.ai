import { describe, expect, it } from 'vitest';

import {
  MAX_POLICY_ID_LENGTH,
  MAX_POLICY_LIMIT,
  MAX_POLICY_WINDOW_SECONDS,
  policyProblem,
} from '@lib/rate-limit';
import type { RateLimitPolicy } from '@lib/rate-limit';

const valid: RateLimitPolicy = {
  id: 'auth.sign-in',
  limit: 5,
  windowSeconds: 60,
  onBackendFailure: 'deny',
};

describe('policyProblem', () => {
  it('accepts a well-formed policy', () => {
    expect(policyProblem(valid)).toBeNull();
  });

  it('accepts the extremes and both optional client modes', () => {
    expect(
      policyProblem({
        ...valid,
        limit: MAX_POLICY_LIMIT,
        windowSeconds: MAX_POLICY_WINDOW_SECONDS,
        onBackendFailure: 'allow',
        onUnresolvedClient: 'skip',
      }),
    ).toBeNull();
    expect(
      policyProblem({ ...valid, limit: 1, windowSeconds: 1, onUnresolvedClient: 'deny' }),
    ).toBeNull();
  });

  it.each(['signin', 'Auth.sign-in', 'auth.', '1auth.sign-in', 'auth.sign_in', 'auth sign.in', ''])(
    'rejects the id %j',
    (id) => {
      expect(policyProblem({ ...valid, id })).toMatch(/^id must look like/);
    },
  );

  it('rejects an id longer than the maximum', () => {
    const id = `a.${'b'.repeat(MAX_POLICY_ID_LENGTH)}`;

    expect(policyProblem({ ...valid, id })).toMatch(/^id must look like/);
  });

  it.each([0, -1, 1.5, Number.NaN, MAX_POLICY_LIMIT + 1])('rejects the limit %s', (limit) => {
    expect(policyProblem({ ...valid, limit })).toMatch(/^limit must be an integer from 1 to/);
  });

  it.each([0, -1, 2.5, Number.POSITIVE_INFINITY, MAX_POLICY_WINDOW_SECONDS + 1])(
    'rejects the window %s',
    (windowSeconds) => {
      expect(policyProblem({ ...valid, windowSeconds })).toMatch(
        /^windowSeconds must be an integer from 1 to/,
      );
    },
  );

  it('rejects a failure mode other than deny or allow', () => {
    const policy = { ...valid, onBackendFailure: 'ignore' } as unknown as RateLimitPolicy;

    expect(policyProblem(policy)).toBe('onBackendFailure must be "deny" or "allow"');
  });

  it('rejects an unresolved-client mode other than skip or deny', () => {
    const policy = { ...valid, onUnresolvedClient: 'share' } as unknown as RateLimitPolicy;

    expect(policyProblem(policy)).toBe('onUnresolvedClient must be "skip" or "deny"');
  });
});
