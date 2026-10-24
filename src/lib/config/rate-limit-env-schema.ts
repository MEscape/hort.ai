import { z } from 'zod';

import { httpUrl, integerSetting } from './env-primitives';

import type { EnvRule } from './env-rules';
import type { ClientAddressSettings, ClientAddressSourceName } from './rate-limit-settings';

const DEFAULT_RATE_LIMIT_TIMEOUT_MS = 1500;
const MIN_RATE_LIMIT_TIMEOUT_MS = 100;
const MAX_RATE_LIMIT_TIMEOUT_MS = 10_000;
const MIN_RATE_LIMIT_SECRET_LENGTH = 32;

/**
 * Rate-limit configuration.
 *
 * Counters always live in Upstash Redis, reached over HTTP: there is no per-process fallback that
 * could quietly stand in for the shared store. Locally and in CI, `docker compose` runs a
 * compatible REST endpoint, so every environment exercises the code that production runs.
 *
 * The REST variables carry the names Upstash and its Vercel integration already
 * set, so a deployment needs no remapping. The key secret falls back to
 * `AUTH_SECRET`, so a deployment that already runs auth needs no new secret.
 *
 * Below the schema: what an unset variable means (`effective…`) and `rateLimitEnvRules`, what must
 * hold across the variables. How they become the limiter's settings is `rate-limit-settings.ts`.
 */
export const rateLimitEnvSchema = z.object({
  /**
   * Where the client address of a request comes from (see `@lib/rate-limit`):
   * `vercel` trusts the platform's own `x-vercel-forwarded-for`, `proxies` strips
   * `x-forwarded-for` back through `AUTH_TRUSTED_PROXIES`, `none` resolves nothing.
   * Unset: `vercel` when running on Vercel (its `VERCEL` system variable is set),
   * else `proxies` when `AUTH_TRUSTED_PROXIES` is set, else `none`. There is no
   * setting that trusts an arbitrary header.
   */
  RATE_LIMIT_CLIENT_ADDRESS_SOURCE: z.enum(['vercel', 'proxies', 'none']).optional(),

  /**
   * Set by Vercel itself, at build and runtime, when "Automatically expose System
   * Environment Variables" is enabled for the project. Only used to pick the
   * `vercel` client-address source; it is a platform signal, not something a
   * request can set.
   */
  VERCEL: z.string().optional(),

  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  RATE_LIMIT_SECRET: z.string().optional(),

  /** Upper bound for one limiter check, including the round trip to the store. */
  RATE_LIMIT_TIMEOUT_MS: integerSetting(DEFAULT_RATE_LIMIT_TIMEOUT_MS, {
    min: MIN_RATE_LIMIT_TIMEOUT_MS,
    max: MAX_RATE_LIMIT_TIMEOUT_MS,
  }),
});

export type RateLimitEnv = z.infer<typeof rateLimitEnvSchema>;

/** The settings that decide how the limiter is built: its own variables plus the ones it falls back to. */
export type RateLimitEnvInput = RateLimitEnv & {
  readonly NODE_ENV: 'development' | 'test' | 'production';
  readonly AUTH_SECRET?: string | undefined;
  readonly AUTH_TRUSTED_PROXIES?: readonly string[] | undefined;
};

/*
 * What an unset variable means, in one place: the rules below and `resolveRateLimitSettings` both
 * read it from here.
 */

/** An empty value (`RATE_LIMIT_SECRET=`) is the same as an unset one. */
export function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

export function effectiveSecret(env: RateLimitEnvInput): string | undefined {
  return nonEmpty(env.RATE_LIMIT_SECRET) ?? nonEmpty(env.AUTH_SECRET);
}

function detectClientAddressSource(
  env: RateLimitEnvInput,
  trustedProxies: readonly string[],
): ClientAddressSourceName {
  if (nonEmpty(env.VERCEL) !== undefined) {
    return 'vercel';
  }
  return trustedProxies.length > 0 ? 'proxies' : 'none';
}

export function effectiveClientAddress(env: RateLimitEnvInput): ClientAddressSettings {
  const trustedProxies = env.AUTH_TRUSTED_PROXIES ?? [];
  const explicit = env.RATE_LIMIT_CLIENT_ADDRESS_SOURCE;
  const source = explicit ?? detectClientAddressSource(env, trustedProxies);
  return {
    source,
    configured: explicit !== undefined || source !== 'none',
    trustedProxies: source === 'proxies' ? trustedProxies : [],
  };
}

/**
 * A trusted proxy is an IP address or an `IP/prefix` range; anything else would silently match
 * nothing. Checked with Zod's own validators rather than `node:net`, which keeps this module free
 * of Node built-ins and so loadable in any runtime the server configuration is read from.
 */
const proxyEntrySchema = z.union([z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()]);

const isProduction = (env: RateLimitEnvInput) => env.NODE_ENV === 'production';
const restUrl = (env: RateLimitEnvInput) => nonEmpty(env.UPSTASH_REDIS_REST_URL);
const isWeak = (secret: string | undefined) => (secret?.length ?? 0) < MIN_RATE_LIMIT_SECRET_LENGTH;

function malformedProxies(env: RateLimitEnvInput): string[] {
  return effectiveClientAddress(env).trustedProxies.filter(
    (entry) => !proxyEntrySchema.safeParse(entry).success,
  );
}

/**
 * What must hold for the rate limiter to start. Reported through the server schema, so a bad
 * deployment fails at startup, not on the first request.
 */
export const rateLimitEnvRules: ReadonlyArray<EnvRule<RateLimitEnvInput>> = [
  {
    path: 'UPSTASH_REDIS_REST_URL',
    violated: (env) => restUrl(env) === undefined,
    message: 'UPSTASH_REDIS_REST_URL is required.',
  },
  {
    path: 'UPSTASH_REDIS_REST_URL',
    violated: (env) => {
      const url = restUrl(env);
      return url !== undefined && !httpUrl.safeParse(url).success;
    },
    message: 'UPSTASH_REDIS_REST_URL must be an http(s) URL.',
  },
  {
    path: 'UPSTASH_REDIS_REST_URL',
    // Every request carries the database token as a bearer credential.
    violated: (env) => {
      const url = restUrl(env);
      return (
        isProduction(env) &&
        url !== undefined &&
        httpUrl.safeParse(url).success &&
        new URL(url).protocol !== 'https:'
      );
    },
    message: 'UPSTASH_REDIS_REST_URL must be an https URL when NODE_ENV=production.',
  },
  {
    path: 'UPSTASH_REDIS_REST_TOKEN',
    violated: (env) => nonEmpty(env.UPSTASH_REDIS_REST_TOKEN) === undefined,
    message: 'UPSTASH_REDIS_REST_TOKEN is required.',
  },

  {
    path: 'RATE_LIMIT_SECRET',
    violated: (env) => isWeak(effectiveSecret(env)),
    message: `RATE_LIMIT_SECRET (or AUTH_SECRET as its fallback) must be at least ${MIN_RATE_LIMIT_SECRET_LENGTH} characters.`,
  },

  {
    path: 'RATE_LIMIT_CLIENT_ADDRESS_SOURCE',
    violated: (env) => {
      const { source, trustedProxies } = effectiveClientAddress(env);
      return source === 'proxies' && trustedProxies.length === 0;
    },
    message:
      'The "proxies" source needs AUTH_TRUSTED_PROXIES (IPs or CIDR ranges of your proxies).',
  },
  {
    path: 'RATE_LIMIT_CLIENT_ADDRESS_SOURCE',
    violated: (env) => malformedProxies(env).length > 0,
    message: (env) =>
      `AUTH_TRUSTED_PROXIES contains entries that are not an IP or CIDR range: ${malformedProxies(env).join(', ')}.`,
  },
];
