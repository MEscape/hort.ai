import type { Clock } from '@lib/clock';
import type { BucketHit, RateLimitStore } from '@lib/rate-limit';

const DEFAULT_MAX_BUCKETS = 10_000;
const MILLISECONDS_PER_SECOND = 1000;

interface Bucket {
  hits: number;
  expiresAtMs: number;
}

/**
 * Counters in this process's memory, with the same window semantics as the Upstash
 * store. A test double ONLY, never wired into the application: each instance (and each
 * serverless invocation environment) has its own counters, they vanish on restart,
 * and nothing is shared.
 *
 * Memory is bounded: at capacity, finished windows are dropped first and, if the
 * table is still full, the hit is rejected (an error, so the policy's failure mode
 * applies) rather than evicting a live counter, which would let a flood reset it.
 * A full table of live counters costs nothing to refuse: the table is only swept once
 * the earliest window in it can have ended, so a flood of new keys cannot make every
 * request scan the whole table.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();
  /** Never later than the earliest `expiresAtMs` in the table: nothing can be finished before it. */
  private earliestExpiryMs = Number.POSITIVE_INFINITY;

  constructor(
    private readonly clock: Clock,
    private readonly maxBuckets: number = DEFAULT_MAX_BUCKETS,
  ) {}

  hit(bucketKey: string, windowSeconds: number): Promise<BucketHit> {
    const nowMs = this.clock.now().getTime();
    const windowMs = windowSeconds * MILLISECONDS_PER_SECOND;
    const existing = this.buckets.get(bucketKey);

    if (existing === undefined && this.buckets.size >= this.maxBuckets) {
      if (nowMs >= this.earliestExpiryMs) {
        this.dropFinished(nowMs);
      }
      if (this.buckets.size >= this.maxBuckets) {
        return Promise.reject(new Error('The in-memory rate-limit store is full.'));
      }
    }

    const bucket: Bucket =
      existing === undefined || existing.expiresAtMs <= nowMs
        ? { hits: 1, expiresAtMs: nowMs + windowMs }
        : { hits: existing.hits + 1, expiresAtMs: existing.expiresAtMs };
    this.buckets.set(bucketKey, bucket);
    this.earliestExpiryMs = Math.min(this.earliestExpiryMs, bucket.expiresAtMs);

    return Promise.resolve({
      hits: bucket.hits,
      retryAfterSeconds: Math.max(
        0,
        Math.ceil((bucket.expiresAtMs - nowMs) / MILLISECONDS_PER_SECOND),
      ),
    });
  }

  /** Forgets every counter whose window has ended and re-learns when the next one will. */
  private dropFinished(nowMs: number): void {
    let earliest = Number.POSITIVE_INFINITY;
    for (const [key, bucket] of this.buckets) {
      if (bucket.expiresAtMs <= nowMs) {
        this.buckets.delete(key);
      } else if (bucket.expiresAtMs < earliest) {
        earliest = bucket.expiresAtMs;
      }
    }
    this.earliestExpiryMs = earliest;
  }
}
