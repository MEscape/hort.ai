import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { RateLimitPolicy } from './rate-limit-policy';
import type { RateLimitSubject } from './rate-limit-subject';

export interface RateLimitRequest {
  readonly policy: RateLimitPolicy;
  readonly subject: RateLimitSubject;
}

/** What an allowed attempt looks like. */
export interface RateLimitAllowance {
  readonly limit: number;
  /** Attempts left in this window, or `null` when the limiter could not count (see `degraded`). */
  readonly remaining: number | null;
  /** Seconds until the window restarts, or `null` when unknown. */
  readonly resetAfterSeconds: number | null;
  /**
   * True when the store was unavailable and the policy chose `allow`: the attempt
   * was let through without being counted.
   */
  readonly degraded: boolean;
}

/**
 * Why an attempt was not allowed.
 * - `RateLimitedAppError`: the budget is spent; `retryAfterSeconds` says for how long.
 * - `InfrastructureAppError`: the limiter itself failed (store down, timeout, or an
 *   invalid policy/subject) and the policy says `deny`. Handle it as a failure, not
 *   as "the user did too much".
 */
export type RateLimitFailure = RateLimitedAppError | InfrastructureAppError;

/**
 * The port every module shares, like `Clock`. Domain and application code import
 * it with `import type` and are handed an instance; only `composition.ts` files
 * call `getRateLimiter()`.
 */
export interface RateLimiter {
  /**
   * Counts one attempt against `policy` for `subject` and says whether it may go ahead.
   * Call it before the expensive or abuse-sensitive work, after the cheap checks that
   * identify who is asking. It never replaces authorization or validation.
   */
  enforce(request: RateLimitRequest): AppResultAsync<RateLimitAllowance, RateLimitFailure>;

  /**
   * Applies several independent policies to one attempt, for an operation that needs more than
   * one budget (say, per client address and per account).
   *
   * - Policies are evaluated one after another, in the order given, and evaluation stops at the
   *   first refusal. Later policies are then not counted, so an attempt turned away by an
   *   earlier one does not use up the later budgets.
   * - Budgets already counted before a refusal are not given back. Put the policy that protects
   *   others first: with the client-address limit before the account limit, one address cannot
   *   burn more of a victim's account budget than its own address budget allows.
   * - The result is the first failure, or the allowances in the order given.
   * - A policy may appear once per call, and the list may not be empty; either is refused as an
   *   invalid request rather than counted twice or not at all.
   */
  enforceAll(
    requests: readonly RateLimitRequest[],
  ): AppResultAsync<readonly RateLimitAllowance[], RateLimitFailure>;
}
