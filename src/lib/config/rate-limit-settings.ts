import { effectiveClientAddress, effectiveSecret, nonEmpty } from './rate-limit-env-schema';

import type { RateLimitEnvInput } from './rate-limit-env-schema';

export type ClientAddressSourceName = 'vercel' | 'proxies' | 'none';

/** How the client address of a request is determined. */
export interface ClientAddressSettings {
  readonly source: ClientAddressSourceName;
  /**
   * False only when the source is `none` because nothing was configured or detected. An operator
   * who wrote `none` made a decision; an unset variable on an unknown platform did not, and the
   * logs say so at warning level.
   */
  readonly configured: boolean;
  /** IPs or CIDR ranges of the proxies in front of the app; only used by `proxies`. */
  readonly trustedProxies: readonly string[];
}

export interface RateLimitSettings {
  readonly restUrl: string;
  readonly restToken: string;
  readonly keySecret: string;
  readonly timeoutMs: number;
  readonly clientAddress: ClientAddressSettings;
}

/**
 * The settings the limiter is built from. `env` is the validated server configuration: the rules
 * in `rate-limit-env-schema.ts` have already refused every combination this cannot build from, at
 * startup, so the only failure left here is a narrowing the types cannot see.
 */
export function resolveRateLimitSettings(env: RateLimitEnvInput): RateLimitSettings {
  const restUrl = nonEmpty(env.UPSTASH_REDIS_REST_URL);
  const restToken = nonEmpty(env.UPSTASH_REDIS_REST_TOKEN);
  const keySecret = effectiveSecret(env);
  if (restUrl === undefined || restToken === undefined || keySecret === undefined) {
    throw new Error('Invalid rate-limit configuration: Upstash URL, token or secret missing.');
  }
  return {
    restUrl,
    restToken,
    keySecret,
    timeoutMs: env.RATE_LIMIT_TIMEOUT_MS,
    clientAddress: effectiveClientAddress(env),
  };
}
