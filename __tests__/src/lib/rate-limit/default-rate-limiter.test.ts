import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RateLimitPolicy, RateLimitRequest } from '@lib/rate-limit';

interface Written {
  readonly level: string;
  readonly message: string;
  readonly context: Record<string, unknown> | undefined;
}

const world = vi.hoisted(() => ({
  nowMs: 0,
  settingsReads: 0,
  settingsError: undefined as Error | undefined,
  written: [] as Written[],
}));

vi.mock('@lib/clock', () => ({ systemClock: { now: () => new Date(world.nowMs) } }));
vi.mock('@lib/config/server', () => ({
  serverEnv: {},
  resolveRateLimitSettings: () => {
    world.settingsReads += 1;
    if (world.settingsError !== undefined) {
      throw world.settingsError;
    }
    return {
      restUrl: 'https://redis.example.org',
      restToken: 'token',
      keySecret: 'k'.repeat(32),
      timeoutMs: 1000,
    };
  },
}));
vi.mock('@lib/logger', () => {
  const write =
    (level: string, base: Record<string, unknown>) =>
    (message: string, ...rest: unknown[]) => {
      const context = rest[rest.length - 1] as Record<string, unknown> | undefined;
      world.written.push({ level, message, context: { ...base, ...context } });
    };
  return {
    logger: {
      withContext: (base: Record<string, unknown>) => ({
        info: write('info', base),
        warn: write('warn', base),
        error: write('error', base),
      }),
    },
  };
});

const policy: RateLimitPolicy = {
  id: 'auth.sign-in',
  limit: 2,
  windowSeconds: 60,
  onBackendFailure: 'deny',
};
const request: RateLimitRequest = { policy, subject: { kind: 'global' } };

/** A tiny Upstash: one counter per key, answering the way the REST endpoint does. */
function fakeUpstash(): { hits: Map<string, number>; fetch: typeof fetch } {
  const hits = new Map<string, number>();
  return {
    hits,
    fetch: (_input, init) => {
      const [, , , key] = JSON.parse(typeof init?.body === 'string' ? init.body : '[]') as [
        string,
        string,
        number,
        string,
      ];
      const count = (hits.get(key) ?? 0) + 1;
      hits.set(key, count);
      return Promise.resolve(Response.json({ result: [count, 60_000] }));
    },
  };
}

async function load() {
  vi.resetModules();
  return (await import('@lib/rate-limit')).getRateLimiter;
}

beforeEach(() => {
  world.nowMs = Date.UTC(2026, 9, 24, 10, 0, 0);
  world.settingsReads = 0;
  world.settingsError = undefined;
  world.written = [];
  Reflect.deleteProperty(globalThis, 'rateLimiter');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getRateLimiter', () => {
  it('reads no configuration until the first attempt', async () => {
    const getRateLimiter = await load();

    getRateLimiter();

    expect(world.settingsReads).toBe(0);
  });

  it('counts attempts in the shared store and refuses those over the limit', async () => {
    const upstash = fakeUpstash();
    vi.stubGlobal('fetch', upstash.fetch);
    const limiter = (await load())();

    const first = await limiter.enforce(request);
    await limiter.enforce(request);
    const third = await limiter.enforce(request);

    expect(first._unsafeUnwrap()).toMatchObject({ remaining: 1, degraded: false });
    expect(third._unsafeUnwrapErr()).toMatchObject({ kind: 'rate_limited', retryAfterSeconds: 60 });
    expect([...upstash.hits.keys()]).toEqual(['rate-limit:auth.sign-in:global']);
  });

  it('applies several budgets at once with enforceAll', async () => {
    vi.stubGlobal('fetch', fakeUpstash().fetch);
    const limiter = (await load())();
    const other: RateLimitRequest = {
      policy: { ...policy, id: 'auth.sign-up' },
      subject: { kind: 'global' },
    };

    const allowances = (await limiter.enforceAll([request, other]))._unsafeUnwrap();

    expect(allowances).toHaveLength(2);
  });

  it('builds the limiter once, however many handles and attempts there are', async () => {
    vi.stubGlobal('fetch', fakeUpstash().fetch);
    const getRateLimiter = await load();

    await getRateLimiter().enforce(request);
    await getRateLimiter().enforce(request);
    await getRateLimiter().enforceAll([request]);

    expect(world.settingsReads).toBe(1);
  });

  it('keeps its counters across a module reload, as hot reload needs', async () => {
    const upstash = fakeUpstash();
    vi.stubGlobal('fetch', upstash.fetch);
    await (await load())().enforce(request);

    const reloaded = (await load())();
    await reloaded.enforce(request);

    expect(world.settingsReads).toBe(1);
  });

  it('fails closed when the store is unreachable and the policy denies', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('network down')));
    const limiter = (await load())();

    const error = (await limiter.enforce(request))._unsafeUnwrapErr();

    expect(error).toMatchObject({ kind: 'infrastructure', code: 'rate_limit.backend_unavailable' });
  });
});

describe('getRateLimiter with unusable configuration', () => {
  const failure = new Error('invalid rate-limit configuration');

  it('refuses attempts with an infrastructure error and never throws', async () => {
    world.settingsError = failure;
    const limiter = (await load())();

    const single = (await limiter.enforce(request))._unsafeUnwrapErr();
    const several = (await limiter.enforceAll([request]))._unsafeUnwrapErr();

    expect(single).toMatchObject({
      kind: 'infrastructure',
      code: 'rate_limit.unavailable',
      cause: failure,
    });
    expect(several).toMatchObject({ code: 'rate_limit.unavailable' });
  });

  it('logs the failure once and does not rebuild for every attempt', async () => {
    world.settingsError = failure;
    const limiter = (await load())();

    await limiter.enforce(request);
    await limiter.enforce(request);
    await limiter.enforce(request);

    expect(world.settingsReads).toBe(1);
    expect(world.written).toEqual([
      {
        level: 'error',
        message: 'rate_limit.unavailable',
        context: { module: 'rate-limit', reason: 'build_failed' },
      },
    ]);
  });

  it('tries again after a few seconds and recovers once the configuration is fixed', async () => {
    vi.stubGlobal('fetch', fakeUpstash().fetch);
    world.settingsError = failure;
    const limiter = (await load())();
    await limiter.enforce(request);

    world.settingsError = undefined;
    world.nowMs += 5000;
    const result = await limiter.enforce(request);

    expect(result._unsafeUnwrap()).toMatchObject({ degraded: false });
    expect(world.settingsReads).toBe(2);
  });
});
