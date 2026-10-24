import type { Clock } from '@lib/clock';
import { createRateLimiter } from '@lib/rate-limit';
import type { RateLimiter, RateLimitLog, RateLimitStore } from '@lib/rate-limit';
import { noop } from '@lib/utils';

import { InMemoryRateLimitStore } from './in-memory-rate-limit-store';

const TEST_KEY_SECRET = 'test-rate-limit-secret-0123456789abcdef';
const TEST_TIMEOUT_MS = 1000;

/** A fixed instant: a window never ends unless the test moves its own clock. */
const FIXED_CLOCK: Clock = { now: () => new Date('2026-01-01T00:00:00.000Z') };

const SILENT_LOG: RateLimitLog = { info: noop, warn: noop, error: noop };

/**
 * The real limiter over an in-memory store, for use-case tests (docs/conventions/adding-a-rate-limit.md).
 *
 * @keep named by the convention; the first rate-limited use case's tests import it
 */
export function createTestRateLimiter(options: { clock?: Clock } = {}): RateLimiter {
  const clock = options.clock ?? FIXED_CLOCK;
  return createRateLimiter({
    store: new InMemoryRateLimitStore(clock),
    keySecret: TEST_KEY_SECRET,
    clock,
    timeoutMs: TEST_TIMEOUT_MS,
    log: SILENT_LOG,
  });
}

/**
 * The real limiter over a store that always fails: what a policy's `onBackendFailure` decides.
 *
 * @keep named by the convention; the first rate-limited use case's tests import it
 */
export function createBrokenRateLimiter(): RateLimiter {
  const store: RateLimitStore = { hit: () => Promise.reject(new Error('The store is down.')) };
  return createRateLimiter({
    store,
    keySecret: TEST_KEY_SECRET,
    clock: FIXED_CLOCK,
    timeoutMs: TEST_TIMEOUT_MS,
    log: SILENT_LOG,
  });
}
