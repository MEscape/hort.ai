import type { Clock } from '@lib/clock';
import { infrastructureError, rateLimitedError } from '@lib/errors';
import type { InfrastructureAppError } from '@lib/errors';
import { err, ok, ResultAsync } from '@lib/result';
import type { AppResult } from '@lib/result';
import { TimeoutError, withTimeout } from '@lib/utils';

import { createLogThrottle } from './rate-limit-log';
import { MAX_POLICY_ID_LENGTH, policyProblem } from './rate-limit-policy';
import { buildBucketKey } from './rate-limit-subject';

import type { RateLimitLog, RateLimitLogContext } from './rate-limit-log';
import type { RateLimitPolicy } from './rate-limit-policy';
import type { BucketHit, RateLimitStore } from './rate-limit-store';
import type {
  RateLimitAllowance,
  RateLimitFailure,
  RateLimiter,
  RateLimitRequest,
} from './rate-limiter';

const DEFAULT_LOG_INTERVAL_MS = 10_000;

const EXCEEDED_CODE = 'rate_limit.exceeded';
const BACKEND_UNAVAILABLE_CODE = 'rate_limit.backend_unavailable';
const INVALID_REQUEST_CODE = 'rate_limit.invalid_request';
const UNEXPECTED_FAILURE_CODE = 'rate_limit.unexpected_failure';
const CLIENT_UNRESOLVED_CODE = 'rate_limit.client_unresolved';
/** Names a composite call in logs; it belongs to no single policy. */
const COMPOSITE_LOG_ID = 'rate-limit.composite';

/** `withTimeout` rejects with our `TimeoutError`; an aborted `fetch` rejects with a `DOMException`. */
function isTimeout(thrown: unknown): boolean {
  return (
    thrown instanceof TimeoutError || (thrown instanceof Error && thrown.name === 'TimeoutError')
  );
}

function failureReason(thrown: unknown): 'timeout' | 'store_error' {
  if (isTimeout(thrown)) {
    return 'timeout';
  }
  return 'store_error';
}

function isBucketHit(value: unknown): value is BucketHit {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { hits, retryAfterSeconds } = value as Partial<Record<keyof BucketHit, unknown>>;
  return (
    typeof hits === 'number' &&
    Number.isInteger(hits) &&
    hits >= 1 &&
    typeof retryAfterSeconds === 'number' &&
    Number.isFinite(retryAfterSeconds)
  );
}

export interface RateLimiterDeps {
  readonly store: RateLimitStore;
  /** Keys the hash of every subject. Secret, at least 32 characters in production. */
  readonly keySecret: string;
  readonly clock: Clock;
  /** Upper bound for one check; the store is abandoned (not cancelled) after it. */
  readonly timeoutMs: number;
  readonly log: RateLimitLog;
  /** Minimum gap between two identical log lines per policy. */
  readonly logIntervalMs?: number;
}

/**
 * The limiter: validates the policy and subject, counts one attempt in the store,
 * and turns the outcome into an allowance, a rate-limited error, or - when the
 * store fails - the policy's declared failure mode.
 *
 * Semantics (fixed window, counted by the store in one atomic step):
 * - Attempt number 1..limit in a window is allowed; every later one is rejected.
 *   Rejected attempts are counted too, but they do not extend the window, so a
 *   client that keeps hammering is released when the window ends.
 * - `retryAfterSeconds` is the time left in the window, rounded up, at least 1 (a `Retry-After`
 *   of 0 would invite an immediate retry, which is the opposite of the point).
 * - Windows are anchored at the first attempt, not on the clock, so up to twice
 *   `limit` attempts can pass across a window boundary. Policies that need a tight
 *   burst bound combine a short window with a longer one.
 * - An invalid policy or subject is a programming or input error and always
 *   denies, whatever the failure mode says: a broken configuration must not
 *   switch protection off.
 */
export function createRateLimiter(deps: RateLimiterDeps): RateLimiter {
  const throttle = createLogThrottle(deps.clock, deps.logIntervalMs ?? DEFAULT_LOG_INTERVAL_MS);

  function admit(event: string, policyId: string): RateLimitLogContext | null {
    const decision = throttle.admit(`${event}:${policyId.slice(0, MAX_POLICY_ID_LENGTH)}`);
    if (!decision.write) {
      return null;
    }
    return decision.suppressed > 0
      ? { policy: policyId, suppressed: decision.suppressed }
      : { policy: policyId };
  }

  function invalid(policyId: string, problem: string): AppResult<never, InfrastructureAppError> {
    const context = admit('invalid', policyId);
    if (context !== null) {
      deps.log.error('rate_limit.invalid_request', new Error(problem), {
        ...context,
        reason: 'invalid_request',
      });
    }
    return err(
      infrastructureError(INVALID_REQUEST_CODE, 'The rate limit could not be evaluated.', problem),
    );
  }

  function backendFailed(
    policy: RateLimitPolicy,
    thrown: unknown,
  ): AppResult<RateLimitAllowance, InfrastructureAppError> {
    const reason = failureReason(thrown);
    const failedOpen = policy.onBackendFailure === 'allow';
    const context = admit(failedOpen ? 'failed_open' : 'backend_failed', policy.id);

    if (failedOpen) {
      if (context !== null) {
        deps.log.warn('rate_limit.failed_open', { ...context, reason });
      }
      return ok({ limit: policy.limit, remaining: null, resetAfterSeconds: null, degraded: true });
    }

    if (context !== null) {
      deps.log.error('rate_limit.backend_failed', thrown, { ...context, reason });
    }
    return err(
      infrastructureError(BACKEND_UNAVAILABLE_CODE, 'Rate limiting is unavailable.', thrown),
    );
  }

  function unresolvedClient(
    policy: RateLimitPolicy,
  ): AppResult<RateLimitAllowance, InfrastructureAppError> {
    const denied = policy.onUnresolvedClient === 'deny';
    const context = admit('unresolved_client', policy.id);
    if (context !== null) {
      deps.log.warn('rate_limit.client_unresolved', {
        ...context,
        reason: denied ? 'denied' : 'skipped',
      });
    }

    if (denied) {
      return err(
        infrastructureError(CLIENT_UNRESOLVED_CODE, 'The request could not be attributed.'),
      );
    }
    return ok({ limit: policy.limit, remaining: null, resetAfterSeconds: null, degraded: true });
  }

  async function check({
    policy,
    subject,
  }: RateLimitRequest): Promise<AppResult<RateLimitAllowance, RateLimitFailure>> {
    const problem = policyProblem(policy);
    if (problem !== null) {
      return invalid(policy.id, `invalid policy: ${problem}`);
    }

    if (subject.kind === 'unresolved-client') {
      return unresolvedClient(policy);
    }

    const bucket = buildBucketKey(policy.id, subject, deps.keySecret);
    if (!bucket.isValid) {
      return invalid(policy.id, `invalid subject: ${bucket.problem}`);
    }

    let answer: unknown;
    try {
      answer = await withTimeout(deps.store.hit(bucket.key, policy.windowSeconds), deps.timeoutMs);
    } catch (thrown) {
      return backendFailed(policy, thrown);
    }

    // The store is behind an interface, so its answer is checked, not trusted.
    if (!isBucketHit(answer)) {
      return backendFailed(policy, new Error('The rate-limit store returned a malformed answer.'));
    }
    const hit = answer;

    if (hit.hits <= policy.limit) {
      return ok({
        limit: policy.limit,
        remaining: policy.limit - hit.hits,
        resetAfterSeconds: Math.max(0, hit.retryAfterSeconds),
        degraded: false,
      });
    }

    const context = admit('rejected', policy.id);
    if (context !== null) {
      deps.log.info('rate_limit.rejected', context);
    }
    // Whole seconds, at least 1, whatever the store said (it is checked for shape, not for sense).
    const retryAfterSeconds = Math.max(1, Math.ceil(hit.retryAfterSeconds));
    return err(
      rateLimitedError(EXCEEDED_CODE, 'Too many attempts. Try again later.', retryAfterSeconds),
    );
  }

  /**
   * `enforce` must never reject: a caller that gets a rejected promise instead of a
   * Result would skip its own error handling. Anything unforeseen therefore denies
   * (a surprise must not switch protection off) and is logged once per interval.
   */
  async function safely<T>(
    run: () => Promise<AppResult<T, RateLimitFailure>>,
  ): Promise<AppResult<T, RateLimitFailure>> {
    try {
      return await run();
    } catch (thrown) {
      const context = admit('unexpected', 'rate-limit.unknown');
      if (context !== null) {
        deps.log.error('rate_limit.unexpected_failure', thrown, context);
      }
      return err(
        infrastructureError(
          UNEXPECTED_FAILURE_CODE,
          'The rate limit could not be evaluated.',
          thrown,
        ),
      );
    }
  }

  async function checkAll(
    requests: readonly RateLimitRequest[],
  ): Promise<AppResult<readonly RateLimitAllowance[], RateLimitFailure>> {
    if (requests.length === 0) {
      return invalid(COMPOSITE_LOG_ID, 'a composite needs at least one policy');
    }
    if (new Set(requests.map((request) => request.policy.id)).size !== requests.length) {
      return invalid(COMPOSITE_LOG_ID, 'a composite cannot use one policy twice');
    }

    // `enforceAll` wraps this whole function in `safely`, so a surprise here still denies.
    const allowances: RateLimitAllowance[] = [];
    for (const request of requests) {
      const result = await check(request);
      if (result.isErr()) {
        return err(result.error);
      }
      allowances.push(result.value);
    }
    return ok(allowances);
  }

  return {
    enforce: (request) => new ResultAsync(safely(() => check(request))),
    enforceAll: (requests) => new ResultAsync(safely(() => checkAll(requests))),
  };
}
