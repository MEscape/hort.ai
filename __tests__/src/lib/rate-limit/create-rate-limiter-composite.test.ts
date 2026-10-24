import { describe, expect, it } from 'vitest';

import type { RateLimitPolicy, RateLimitRequest } from '@lib/rate-limit';

import { InMemoryRateLimitStore } from '../../support/in-memory-rate-limit-store';

import { setupLimiter } from './fakes';

const perClient: RateLimitPolicy = {
  id: 'auth.sign-in-client',
  limit: 2,
  windowSeconds: 60,
  onBackendFailure: 'deny',
};
const perAccount: RateLimitPolicy = { ...perClient, id: 'auth.sign-in', limit: 5 };

const byClient: RateLimitRequest = {
  policy: perClient,
  subject: { kind: 'client', address: '203.0.113.7' },
};
const byAccount: RateLimitRequest = {
  policy: perAccount,
  subject: { kind: 'identifier', value: 'ada@example.org' },
};

const setup = () => setupLimiter((clock) => new InMemoryRateLimitStore(clock));

describe('createRateLimiter enforceAll', () => {
  it('returns the allowances in the order given', async () => {
    const { limiter } = setup();

    const allowances = (await limiter.enforceAll([byClient, byAccount]))._unsafeUnwrap();

    expect(allowances.map((allowance) => allowance.limit)).toEqual([2, 5]);
    expect(allowances.map((allowance) => allowance.remaining)).toEqual([1, 4]);
  });

  it('stops at the first refusal and does not count the later budgets', async () => {
    const { limiter } = setup();
    await limiter.enforceAll([byClient, byAccount]);
    await limiter.enforceAll([byClient, byAccount]);

    const error = (await limiter.enforceAll([byClient, byAccount]))._unsafeUnwrapErr();
    const account = (await limiter.enforce(byAccount))._unsafeUnwrap();

    expect(error).toMatchObject({ kind: 'rate_limited', code: 'rate_limit.exceeded' });
    expect(account.remaining).toBe(2);
  });

  it('keeps budgets already counted before a later refusal', async () => {
    const { limiter } = setup();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await limiter.enforce(byAccount);
    }

    const error = (await limiter.enforceAll([byClient, byAccount]))._unsafeUnwrapErr();
    const client = (await limiter.enforce(byClient))._unsafeUnwrap();

    expect(error).toMatchObject({ kind: 'rate_limited' });
    expect(client.remaining).toBe(0);
  });

  it('refuses an empty list as an invalid request', async () => {
    const { limiter, log } = setup();

    const error = (await limiter.enforceAll([]))._unsafeUnwrapErr();

    expect(error).toMatchObject({ kind: 'infrastructure', code: 'rate_limit.invalid_request' });
    expect(log.entries[0]?.context).toMatchObject({ policy: 'rate-limit.composite' });
  });

  it('refuses one policy used twice instead of counting it twice', async () => {
    const { limiter } = setup();

    const error = (await limiter.enforceAll([byClient, byClient]))._unsafeUnwrapErr();
    const client = (await limiter.enforce(byClient))._unsafeUnwrap();

    expect(error).toMatchObject({ code: 'rate_limit.invalid_request' });
    expect(client.remaining).toBe(1);
  });
});
