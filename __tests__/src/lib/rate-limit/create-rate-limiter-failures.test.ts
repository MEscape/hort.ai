import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BucketHit, RateLimitPolicy, RateLimitRequest, RateLimitStore } from '@lib/rate-limit';

import { setupLimiter } from './fakes';

const deny: RateLimitPolicy = {
  id: 'auth.sign-in',
  limit: 3,
  windowSeconds: 60,
  onBackendFailure: 'deny',
};
const allow: RateLimitPolicy = { ...deny, id: 'content.view', onBackendFailure: 'allow' };
const requestFor = (policy: RateLimitPolicy): RateLimitRequest => ({
  policy,
  subject: { kind: 'global' },
});

const storeThat = (hit: () => Promise<unknown>): RateLimitStore => ({
  hit: () => hit() as Promise<BucketHit>,
});
// A store may reject with anything; non-Error rejections are part of what is tested.
const failing = (thrown: unknown) =>
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- rejecting with a non-Error is the case under test
  storeThat(() => Promise.reject(thrown));
const answering = (answer: unknown) => storeThat(() => Promise.resolve(answer));

afterEach(() => {
  vi.useRealTimers();
});

describe('createRateLimiter when the store fails', () => {
  it('denies by default with an infrastructure error that keeps the cause', async () => {
    const cause = new Error('connection reset');
    const { limiter, log } = setupLimiter(() => failing(cause));

    const error = (await limiter.enforce(requestFor(deny)))._unsafeUnwrapErr();

    expect(error).toMatchObject({
      kind: 'infrastructure',
      code: 'rate_limit.backend_unavailable',
      cause,
    });
    expect(log.entries).toEqual([
      {
        level: 'error',
        message: 'rate_limit.backend_failed',
        error: cause,
        context: { policy: 'auth.sign-in', reason: 'store_error' },
      },
    ]);
  });

  it('lets the attempt through, flagged and uncounted, when the policy fails open', async () => {
    const { limiter, log } = setupLimiter(() => failing(new Error('down')));

    const result = await limiter.enforce(requestFor(allow));

    expect(result._unsafeUnwrap()).toEqual({
      limit: 3,
      remaining: null,
      resetAfterSeconds: null,
      degraded: true,
    });
    expect(log.entries).toEqual([
      {
        level: 'warn',
        message: 'rate_limit.failed_open',
        context: { policy: 'content.view', reason: 'store_error' },
      },
    ]);
  });

  it('logs a failure once per interval and then reports the dropped count', async () => {
    const { limiter, log, clock } = setupLimiter(() => failing('boom'));

    await limiter.enforce(requestFor(deny));
    await limiter.enforce(requestFor(deny));
    await limiter.enforce(requestFor(allow));
    await limiter.enforce(requestFor(allow));
    expect(log.entries).toHaveLength(2);

    clock.advance(10_000);
    await limiter.enforce(requestFor(deny));

    expect(log.entries[2]?.context).toEqual({
      policy: 'auth.sign-in',
      suppressed: 1,
      reason: 'store_error',
    });
  });

  it('abandons a store that does not answer in time', async () => {
    vi.useFakeTimers();
    const { limiter, log } = setupLimiter(() => storeThat(() => new Promise(() => undefined)), {
      timeoutMs: 250,
    });

    const pending = limiter.enforce(requestFor(deny));
    await vi.advanceTimersByTimeAsync(250);
    const error = (await pending)._unsafeUnwrapErr();

    expect(error).toMatchObject({ code: 'rate_limit.backend_unavailable' });
    expect(log.entries[0]?.context).toMatchObject({ reason: 'timeout' });
  });

  it('also recognises an aborted fetch as a timeout', async () => {
    const aborted = Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    const { limiter, log } = setupLimiter(() => failing(aborted));

    await limiter.enforce(requestFor(allow));

    expect(log.entries[0]?.context).toMatchObject({ reason: 'timeout' });
  });

  it.each([
    ['null', null],
    ['a string', 'ok'],
    ['an empty object', {}],
    ['zero hits', { hits: 0, retryAfterSeconds: 1 }],
    ['fractional hits', { hits: 1.5, retryAfterSeconds: 1 }],
    ['text hits', { hits: '1', retryAfterSeconds: 1 }],
    ['no time left', { hits: 1 }],
    ['text time left', { hits: 1, retryAfterSeconds: '5' }],
    ['a non-finite time left', { hits: 1, retryAfterSeconds: Number.NaN }],
  ])('treats %s as a failure of the store', async (_name, answer) => {
    const { limiter, log } = setupLimiter(() => answering(answer));

    const denied = (await limiter.enforce(requestFor(deny)))._unsafeUnwrapErr();
    const allowed = (await limiter.enforce(requestFor(allow)))._unsafeUnwrap();

    expect(denied).toMatchObject({ code: 'rate_limit.backend_unavailable' });
    expect(allowed.degraded).toBe(true);
    expect(log.entries[0]?.error).toEqual(
      new Error('The rate-limit store returned a malformed answer.'),
    );
  });
});

describe('createRateLimiter and the store answer', () => {
  it('never answers a Retry-After below 1 or fractional, whatever the store said', async () => {
    const retry = async (retryAfterSeconds: number) => {
      const { limiter } = setupLimiter(() => answering({ hits: 9, retryAfterSeconds }));
      return (await limiter.enforce(requestFor(deny)))._unsafeUnwrapErr();
    };

    expect(await retry(0)).toMatchObject({ retryAfterSeconds: 1 });
    expect(await retry(-5)).toMatchObject({ retryAfterSeconds: 1 });
    expect(await retry(2.2)).toMatchObject({ retryAfterSeconds: 3 });
  });

  it('never reports a negative reset time for an allowed attempt', async () => {
    const { limiter } = setupLimiter(() => answering({ hits: 1, retryAfterSeconds: -3 }));

    const allowance = (await limiter.enforce(requestFor(deny)))._unsafeUnwrap();

    expect(allowance).toMatchObject({ remaining: 2, resetAfterSeconds: 0 });
  });

  it('passes the hashed key and the window to the store, never the subject', async () => {
    const seen: Array<{ key: string; windowSeconds: number }> = [];
    const { limiter } = setupLimiter(() => ({
      hit: (key, windowSeconds) => {
        seen.push({ key, windowSeconds });
        return Promise.resolve({ hits: 1, retryAfterSeconds: 1 });
      },
    }));

    await limiter.enforce({
      policy: deny,
      subject: { kind: 'identifier', value: 'ada@example.org' },
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]?.windowSeconds).toBe(60);
    expect(seen[0]?.key).toMatch(/^auth\.sign-in:identifier:[0-9a-f]{64}$/);
  });
});

describe('createRateLimiter never rejects', () => {
  const exploding = {
    get policy(): RateLimitPolicy {
      throw new Error('unforeseen');
    },
    subject: { kind: 'global' },
  } as unknown as RateLimitRequest;

  it('turns a surprise in enforce into a denial', async () => {
    const { limiter, log } = setupLimiter(() => answering({ hits: 1, retryAfterSeconds: 1 }));

    const error = (await limiter.enforce(exploding))._unsafeUnwrapErr();

    expect(error).toMatchObject({ kind: 'infrastructure', code: 'rate_limit.unexpected_failure' });
    expect(log.entries[0]).toMatchObject({
      level: 'error',
      message: 'rate_limit.unexpected_failure',
      context: { policy: 'rate-limit.unknown' },
    });
  });

  it('turns a surprise in enforceAll into a denial and logs it once per interval', async () => {
    const { limiter, log } = setupLimiter(() => answering({ hits: 1, retryAfterSeconds: 1 }));

    const first = (await limiter.enforceAll([exploding]))._unsafeUnwrapErr();
    await limiter.enforceAll([exploding]);

    expect(first).toMatchObject({ code: 'rate_limit.unexpected_failure' });
    expect(log.entries).toHaveLength(1);
  });
});
