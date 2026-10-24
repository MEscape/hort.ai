import 'server-only';

import { z } from 'zod';

import type { BucketHit, RateLimitStore } from './rate-limit-store';

const KEY_PREFIX = 'rate-limit:';
const MILLISECONDS_PER_SECOND = 1000;
const TRAILING_SLASHES = /\/+$/;
const SINGLE_KEY = 1;

/**
 * One script counts the attempt and reads the window, so two concurrent requests cannot both see
 * "9 of 10" and both pass: Redis runs a script without interleaving other commands. A single
 * command is atomic on every Redis, however the REST endpoint in front of it multiplexes requests.
 *
 * - `INCR` creates the counter at 1 on the first attempt of a window.
 * - `EXPIRE ... NX` starts the window by giving a counter without a lifetime one, and leaves a
 *   running window alone. A rejected attempt is counted but never extends the window, and a counter
 *   that somehow lost its lifetime heals itself on the next attempt instead of living forever.
 * - `PTTL` reads what is left. Redis deletes the counter when it runs out, so no clean-up job exists.
 */
const HIT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[1], 'NX')
return { hits, redis.call('PTTL', KEYS[1]) }
`;

/** `{ result: [hits, ms left] }`; a failed script answers `{ error }` instead. */
const hitAnswerSchema = z.object({
  result: z.tuple([z.number().int().min(1), z.number().int().min(0)]),
});

export interface UpstashRateLimitStoreOptions {
  /** The database's REST endpoint, e.g. `https://eu1-example-12345.upstash.io`. */
  readonly restUrl: string;
  readonly restToken: string;
  /** Aborts the request, so a stalled network holds a protected request for no longer than this. */
  readonly timeoutMs: number;
  /** The platform `fetch`; replaced only by tests. */
  readonly fetch?: typeof fetch;
}

/**
 * Fixed-window counters in Upstash Redis, spoken to over its REST API with the platform `fetch`:
 * no driver, no connection pool, and nothing that holds a socket open between serverless
 * invocations. Every instance that points at the same database shares the counters.
 */
export class UpstashRateLimitStore implements RateLimitStore {
  private readonly endpoint: string;

  constructor(private readonly options: UpstashRateLimitStoreOptions) {
    this.endpoint = options.restUrl.replace(TRAILING_SLASHES, '');
  }

  async hit(bucketKey: string, windowSeconds: number): Promise<BucketHit> {
    const send = this.options.fetch ?? fetch;
    const response = await send(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.restToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        'EVAL',
        HIT_SCRIPT,
        SINGLE_KEY,
        `${KEY_PREFIX}${bucketKey}`,
        windowSeconds,
      ]),
      cache: 'no-store',
      signal: AbortSignal.timeout(this.options.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Upstash answered HTTP ${response.status}.`);
    }

    // The answer is external data, so its shape is parsed, not assumed (validation.md).
    const answer = hitAnswerSchema.safeParse(await response.json());
    if (!answer.success) {
      throw new Error('Upstash answered a rate-limit script in an unexpected shape.', {
        cause: answer.error,
      });
    }
    const [hits, timeToLiveMs] = answer.data.result;
    return { hits, retryAfterSeconds: Math.ceil(timeToLiveMs / MILLISECONDS_PER_SECOND) };
  }
}
