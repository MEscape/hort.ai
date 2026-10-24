import type { Clock } from '@lib/clock';

/** Only identifiers that are safe to log: a policy id, a count, a coarse reason. Never a key, address or user id. */
export interface RateLimitLogContext {
  /** Absent for events that belong to no policy (client-address resolution). */
  readonly policy?: string;
  readonly reason?: string;
  /** How many identical events were dropped since the last one that was written. */
  readonly suppressed?: number;
}

/** The slice of `@lib/logger` the limiter needs; `logger.withContext(...)` satisfies it. */
export interface RateLimitLog {
  info(message: string, context?: RateLimitLogContext): void;
  warn(message: string, context?: RateLimitLogContext): void;
  error(message: string, error: unknown, context?: RateLimitLogContext): void;
}

/** Enough distinct (event, policy) pairs for every policy in the codebase, but bounded. */
const MAX_TRACKED_EVENTS = 512;

interface Tracked {
  lastWrittenAtMs: number;
  suppressed: number;
}

export interface LogThrottle {
  /**
   * Whether this event may be written now. At most one write per `intervalMs` for the
   * same key; the writes that follow a quiet period carry how many were dropped.
   */
  admit(key: string): { readonly write: boolean; readonly suppressed: number };
}

/**
 * Under a flood every rejected request would otherwise be one log line (a log flood
 * is its own denial of service, and a bill). Rejections, failures and fail-open
 * events are therefore written once per interval per policy, with a count of the
 * rest.
 */
export function createLogThrottle(clock: Clock, intervalMs: number): LogThrottle {
  const tracked = new Map<string, Tracked>();

  return {
    admit(key) {
      const nowMs = clock.now().getTime();
      const entry = tracked.get(key);

      if (entry !== undefined && nowMs - entry.lastWrittenAtMs < intervalMs) {
        entry.suppressed += 1;
        return { write: false, suppressed: 0 };
      }

      if (entry === undefined && tracked.size >= MAX_TRACKED_EVENTS) {
        tracked.clear();
      }
      const suppressed = entry?.suppressed ?? 0;
      tracked.set(key, { lastWrittenAtMs: nowMs, suppressed: 0 });
      return { write: true, suppressed };
    },
  };
}
