import type { Clock } from '@lib/clock';
import { createRateLimiter } from '@lib/rate-limit';
import type {
  RateLimiterDeps,
  RateLimitLog,
  RateLimitLogContext,
  RateLimitStore,
} from '@lib/rate-limit';

export interface FakeClock extends Clock {
  advance(ms: number): void;
}

/** A clock that only moves when the test says so. */
export function createFakeClock(startMs = Date.UTC(2026, 9, 24, 10, 0, 0)): FakeClock {
  let nowMs = startMs;
  return {
    now: () => new Date(nowMs),
    advance: (ms) => {
      nowMs += ms;
    },
  };
}

export interface LogEntry {
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly error?: unknown;
  readonly context?: RateLimitLogContext | undefined;
}

export interface RecordingLog extends RateLimitLog {
  readonly entries: LogEntry[];
}

/** A log that remembers what was written to it. */
export function createRecordingLog(): RecordingLog {
  const entries: LogEntry[] = [];
  return {
    entries,
    info: (message, context) => {
      entries.push({ level: 'info', message, context });
    },
    warn: (message, context) => {
      entries.push({ level: 'warn', message, context });
    },
    error: (message, error, context) => {
      entries.push({ level: 'error', message, error, context });
    },
  };
}

export const KEY_SECRET = 'k'.repeat(32);

/** A limiter wired to a store built on the shared fake clock, and a recording log. */
export function setupLimiter(
  makeStore: (clock: FakeClock) => RateLimitStore,
  overrides: Partial<RateLimiterDeps> = {},
) {
  const clock = createFakeClock();
  const log = createRecordingLog();
  const limiter = createRateLimiter({
    store: makeStore(clock),
    keySecret: KEY_SECRET,
    clock,
    timeoutMs: 1000,
    log,
    ...overrides,
  });
  return { limiter, clock, log };
}
