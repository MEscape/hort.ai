import { describe, expect, it } from 'vitest';

import type { RateLimitPolicy, RateLimitRequest, RateLimitSubject } from '@lib/rate-limit';

import { InMemoryRateLimitStore } from '../../support/in-memory-rate-limit-store';

import { setupLimiter } from './fakes';

const policy: RateLimitPolicy = {
  id: 'auth.sign-in',
  limit: 2,
  windowSeconds: 60,
  onBackendFailure: 'deny',
};
const client = (address: string): RateLimitSubject => ({ kind: 'client', address });
const request = (subject: RateLimitSubject, p: RateLimitPolicy = policy): RateLimitRequest => ({
  policy: p,
  subject,
});

const setup = () => setupLimiter((clock) => new InMemoryRateLimitStore(clock));

describe('createRateLimiter enforce', () => {
  it('allows attempts up to the limit and says how many are left', async () => {
    const { limiter } = setup();

    const first = await limiter.enforce(request(client('203.0.113.7')));
    const second = await limiter.enforce(request(client('203.0.113.7')));

    expect(first._unsafeUnwrap()).toEqual({
      limit: 2,
      remaining: 1,
      resetAfterSeconds: 60,
      degraded: false,
    });
    expect(second._unsafeUnwrap()).toMatchObject({ remaining: 0, degraded: false });
  });

  it('rejects the attempt over the limit with a Retry-After of the time left', async () => {
    const { limiter, clock } = setup();
    await limiter.enforce(request(client('203.0.113.7')));
    await limiter.enforce(request(client('203.0.113.7')));
    clock.advance(20_500);

    const error = (await limiter.enforce(request(client('203.0.113.7'))))._unsafeUnwrapErr();

    expect(error).toMatchObject({
      kind: 'rate_limited',
      code: 'rate_limit.exceeded',
      retryAfterSeconds: 40,
    });
  });

  it('releases a client when the window ends, even after hammering', async () => {
    const { limiter, clock } = setup();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await limiter.enforce(request(client('203.0.113.7')));
    }
    clock.advance(60_000);

    const result = await limiter.enforce(request(client('203.0.113.7')));

    expect(result._unsafeUnwrap()).toMatchObject({ remaining: 1 });
  });

  it('counts each subject, kind and policy separately', async () => {
    const { limiter } = setup();
    await limiter.enforce(request(client('203.0.113.7')));
    await limiter.enforce(request(client('203.0.113.7')));
    const other: RateLimitPolicy = { ...policy, id: 'auth.sign-up' };

    const results = await Promise.all([
      limiter.enforce(request(client('203.0.113.8'))),
      limiter.enforce(request({ kind: 'identifier', value: '203.0.113.7' })),
      limiter.enforce(request({ kind: 'actor', tenantId: 't', actorId: 'u' })),
      limiter.enforce(request(client('203.0.113.7'), other)),
    ]);

    expect(results.every((result) => result.isOk())).toBe(true);
  });

  it('treats differently written identifiers as one account', async () => {
    const { limiter } = setup();
    await limiter.enforce(request({ kind: 'identifier', value: 'Ada@Example.org' }));
    await limiter.enforce(request({ kind: 'identifier', value: ' ada@example.org ' }));

    const result = await limiter.enforce(request({ kind: 'identifier', value: 'ADA@example.org' }));

    expect(result.isErr()).toBe(true);
  });

  it('shares one counter for the global subject', async () => {
    const { limiter } = setup();
    await limiter.enforce(request({ kind: 'global' }));
    await limiter.enforce(request({ kind: 'global' }));

    const result = await limiter.enforce(request({ kind: 'global' }));

    expect(result._unsafeUnwrapErr()).toMatchObject({ kind: 'rate_limited' });
  });

  it('logs rejections once per interval, without any subject', async () => {
    const { limiter, log, clock } = setup();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await limiter.enforce(request(client('203.0.113.7')));
    }
    expect(log.entries).toEqual([
      { level: 'info', message: 'rate_limit.rejected', context: { policy: 'auth.sign-in' } },
    ]);

    clock.advance(10_000);
    await limiter.enforce(request(client('203.0.113.7')));

    expect(log.entries[1]?.context).toEqual({ policy: 'auth.sign-in', suppressed: 2 });
    expect(JSON.stringify(log.entries)).not.toContain('203.0.113.7');
  });

  it('honours a custom log interval', async () => {
    const { limiter, log, clock } = setupLimiter((c) => new InMemoryRateLimitStore(c), {
      logIntervalMs: 5,
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await limiter.enforce(request({ kind: 'global' }));
    }
    clock.advance(5);
    await limiter.enforce(request({ kind: 'global' }));

    expect(log.entries).toHaveLength(2);
  });
});

describe('createRateLimiter invalid input', () => {
  it.each([
    ['policy', request({ kind: 'global' }, { ...policy, limit: 0 }), 'invalid policy: limit'],
    [
      'policy even when it would fail open',
      request({ kind: 'global' }, { ...policy, id: 'BAD', onBackendFailure: 'allow' }),
      'invalid policy: id',
    ],
    [
      'subject',
      request({ kind: 'identifier', value: '  ' }),
      'invalid subject: identifier subject',
    ],
  ])('always denies an invalid %s', async (_name, invalidRequest, problem) => {
    const { limiter, log } = setup();

    const error = (await limiter.enforce(invalidRequest))._unsafeUnwrapErr();

    expect(error).toMatchObject({ kind: 'infrastructure', code: 'rate_limit.invalid_request' });
    expect(log.entries[0]).toMatchObject({ level: 'error', message: 'rate_limit.invalid_request' });
    expect((log.entries[0]?.error as Error).message).toContain(problem);
  });

  it('logs invalid requests once per interval', async () => {
    const { limiter, log } = setup();
    const invalid = request({ kind: 'global' }, { ...policy, limit: 0 });

    await limiter.enforce(invalid);
    await limiter.enforce(invalid);

    expect(log.entries).toHaveLength(1);
  });

  it('keeps the log key bounded for an oversized policy id', async () => {
    const { limiter, log } = setup();

    const result = await limiter.enforce(
      request({ kind: 'global' }, { ...policy, id: 'x'.repeat(5000) }),
    );

    expect(result.isErr()).toBe(true);
    expect(log.entries).toHaveLength(1);
  });
});

describe('createRateLimiter unresolved clients', () => {
  const unresolved: RateLimitSubject = { kind: 'unresolved-client' };

  it('skips the limit, uncounted and flagged, by default', async () => {
    const { limiter, log } = setup();

    const result = await limiter.enforce(request(unresolved));

    expect(result._unsafeUnwrap()).toEqual({
      limit: 2,
      remaining: null,
      resetAfterSeconds: null,
      degraded: true,
    });
    expect(log.entries[0]).toMatchObject({
      level: 'warn',
      context: { policy: 'auth.sign-in', reason: 'skipped' },
    });
  });

  it('denies when the policy says so', async () => {
    const { limiter, log } = setup();

    const error = (
      await limiter.enforce(request(unresolved, { ...policy, onUnresolvedClient: 'deny' }))
    )._unsafeUnwrapErr();

    expect(error).toMatchObject({ kind: 'infrastructure', code: 'rate_limit.client_unresolved' });
    expect(log.entries[0]?.context).toMatchObject({ reason: 'denied' });
  });

  it('logs it once per interval', async () => {
    const { limiter, log } = setup();

    await limiter.enforce(request(unresolved));
    await limiter.enforce(request(unresolved));

    expect(log.entries).toHaveLength(1);
  });
});
