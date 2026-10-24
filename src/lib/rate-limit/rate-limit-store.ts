/** The state of one counter after a hit was recorded. */
export interface BucketHit {
  /** Hits in the current window, including this one. */
  readonly hits: number;
  /** Whole seconds until the current window ends and the counter restarts (at least 0). */
  readonly retryAfterSeconds: number;
}

/**
 * Where the counters live. Provider details stay behind this interface.
 *
 * A store rejects (throws) when it cannot answer; it never answers from some
 * other place instead. The limiter turns that into the policy's failure mode.
 * A store forgets a counter by itself once its window has ended: nothing has to
 * clean up after it.
 */
export interface RateLimitStore {
  /**
   * Counts one attempt in the counter's current window and reports the result in
   * one atomic step: two concurrent hits must never both observe the same count.
   * A window that has run out is restarted by the same step.
   */
  hit(bucketKey: string, windowSeconds: number): Promise<BucketHit>;
}
