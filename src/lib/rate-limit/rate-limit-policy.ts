/**
 * What happens to the protected operation when the limiter's store cannot answer.
 *
 * - `deny`: the operation is refused. Use it wherever a flood is costly or harmful.
 * - `allow`: the operation proceeds unlimited. Use it only where a short gap in
 *   protection costs less than refusing real users, and expect a `warn` log.
 *
 * There is no third option: a limiter never quietly counts in local memory instead.
 */
export type RateLimitFailureMode = 'deny' | 'allow';

/**
 * What happens when a limit is keyed by client address and the address could not be
 * determined (misconfigured proxy, missing or malformed header, request outside a request scope).
 *
 * - `skip`: this limit is not applied, the attempt is let through uncounted and a `warn` is logged.
 *   Right when another limit still protects the operation (an account-keyed one, say).
 * - `deny`: the attempt is refused. Right when the address is the only thing standing between the
 *   operation and a flood.
 *
 * There is no "share one counter among all unidentified clients" option: it would let a single
 * flood lock out everyone whose address is unknown.
 */
export type RateLimitUnresolvedClientMode = 'skip' | 'deny';

/**
 * One named budget: `limit` attempts per fixed window of `windowSeconds`.
 *
 * Policies are plain data, declared next to the use case they protect. Every
 * field is required, including `onBackendFailure`, so a policy cannot bypass
 * the limiter by omission.
 */
export interface RateLimitPolicy {
  /** Stable and unique, `module.operation` (kebab-case parts). It becomes part of the stored key. */
  readonly id: string;
  /** Attempts allowed per window. */
  readonly limit: number;
  /** Window length in seconds. */
  readonly windowSeconds: number;
  readonly onBackendFailure: RateLimitFailureMode;
  /** Only read for `client` subjects. Default `skip`. */
  readonly onUnresolvedClient?: RateLimitUnresolvedClientMode;
}

export const MAX_POLICY_ID_LENGTH = 64;
export const MAX_POLICY_LIMIT = 100_000;
export const MAX_POLICY_WINDOW_SECONDS = 86_400;

const POLICY_ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

function isIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function modeProblem(policy: RateLimitPolicy): string | null {
  // Policies are plain data that may come from anywhere, so the types are not taken on trust.
  const failureMode: string = policy.onBackendFailure;
  if (failureMode !== 'deny' && failureMode !== 'allow') {
    return 'onBackendFailure must be "deny" or "allow"';
  }
  const unresolved: string | undefined = policy.onUnresolvedClient;
  if (unresolved !== undefined && unresolved !== 'skip' && unresolved !== 'deny') {
    return 'onUnresolvedClient must be "skip" or "deny"';
  }
  return null;
}

/** A description of what is wrong with the policy, or `null` when it is usable. */
export function policyProblem(policy: RateLimitPolicy): string | null {
  if (policy.id.length > MAX_POLICY_ID_LENGTH || !POLICY_ID_PATTERN.test(policy.id)) {
    return 'id must look like "module.operation" (lowercase, digits, hyphens) and fit in 64 characters';
  }
  if (!isIntegerInRange(policy.limit, 1, MAX_POLICY_LIMIT)) {
    return `limit must be an integer from 1 to ${MAX_POLICY_LIMIT}`;
  }
  if (!isIntegerInRange(policy.windowSeconds, 1, MAX_POLICY_WINDOW_SECONDS)) {
    return `windowSeconds must be an integer from 1 to ${MAX_POLICY_WINDOW_SECONDS}`;
  }
  return modeProblem(policy);
}
