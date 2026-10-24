import 'server-only';

import { systemClock } from '@lib/clock';
import { resolveRateLimitSettings, serverEnv } from '@lib/config/server';
import { infrastructureError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { once, resolveLazy } from '@lib/utils';
import type { LazyCell, LazyFailure } from '@lib/utils';

import { createRateLimiter } from './create-rate-limiter';
import { createDisabledRateLimiter } from './disabled-rate-limiter';
import { createRateLimitLog } from './rate-limit-logger';
import { UpstashRateLimitStore } from './upstash-rate-limit-store';

import type { RateLimitFailure, RateLimiter } from './rate-limiter';

const globalForRateLimit = globalThis as unknown as {
  rateLimiter: RateLimiter | undefined;
}; // globalThis has no declared shape; this is the standard hot-reload singleton pattern.

function buildLimiter(): RateLimiter {
  const settings = resolveRateLimitSettings(serverEnv);
  return createRateLimiter({
    store: new UpstashRateLimitStore({
      restUrl: settings.restUrl,
      restToken: settings.restToken,
      timeoutMs: settings.timeoutMs,
    }),
    // The key secret is part of every counter's key. Instances that do not share one count the same
    // client under different keys, so the "shared" limit would silently become one limit per instance.
    keySecret: settings.keySecret,
    clock: systemClock,
    timeoutMs: settings.timeoutMs,
    log: createRateLimitLog(),
  });
}

let failureState: LazyFailure | undefined;

/** Built on first use and kept, so the "rate limiting is off" warning is written once per process. */
const disabledLimiter = once(() => createDisabledRateLimiter(createRateLimitLog()));

/** The limiter lives on `globalThis` so hot reload keeps its counters; a remembered failure need not. */
const cell: LazyCell<RateLimiter> = {
  get: () => globalForRateLimit.rateLimiter,
  set: (limiter) => {
    globalForRateLimit.rateLimiter = limiter;
    failureState = undefined;
  },
  getFailure: () => failureState,
  setFailure: (failure) => {
    failureState = failure;
  },
};

/**
 * The application's rate limiter. Only `composition.ts` files call this and hand the result to use
 * cases as a `RateLimiter`.
 *
 * With `RATE_LIMIT_ENABLED=false` (development only) it counts nothing and allows every attempt.
 *
 * Nothing is built until the first `enforce`: importing a composition root (during `next build`, or
 * at module load) reads no configuration and opens no connection. If building the real limiter then
 * fails, the attempt is refused with an infrastructure error, which is what every policy that denies
 * on failure wants, and `enforce` still never throws. The failure is remembered for a few seconds
 * and logged once, not rebuilt and logged per request. It never falls back to another backend: if
 * the configured store is down, each policy's `onBackendFailure` decides.
 */
export function getRateLimiter(): RateLimiter {
  function guarded<T>(
    run: (built: RateLimiter) => AppResultAsync<T, RateLimitFailure>,
  ): AppResultAsync<T, RateLimitFailure> {
    if (!serverEnv.RATE_LIMIT_ENABLED) {
      return run(disabledLimiter());
    }
    const built = resolveLazy({
      cell,
      build: buildLimiter,
      clock: systemClock,
      onFailure: (thrown) => {
        createRateLimitLog().error('rate_limit.unavailable', thrown, { reason: 'build_failed' });
      },
    });
    if (!built.isReady) {
      return errAsync(
        infrastructureError('rate_limit.unavailable', 'Rate limiting is unavailable.', built.error),
      );
    }
    return run(built.value);
  }

  return {
    enforce: (request) => guarded((limiter) => limiter.enforce(request)),
    enforceAll: (requests) => guarded((limiter) => limiter.enforceAll(requests)),
  };
}
