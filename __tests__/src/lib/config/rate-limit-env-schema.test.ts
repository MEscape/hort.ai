import { describe, expect, it } from 'vitest';

import { envRuleIssues } from '@lib/config/env-rules';
import {
  effectiveClientAddress,
  effectiveSecret,
  nonEmpty,
  rateLimitEnvRules,
  rateLimitEnvSchema,
} from '@lib/config/rate-limit-env-schema';
import type { RateLimitEnvInput } from '@lib/config/rate-limit-env-schema';

const SECRET = 's'.repeat(32);

const valid: RateLimitEnvInput = {
  ...rateLimitEnvSchema.parse({}),
  NODE_ENV: 'development',
  UPSTASH_REDIS_REST_URL: 'http://localhost:8079',
  UPSTASH_REDIS_REST_TOKEN: 'token',
  RATE_LIMIT_SECRET: SECRET,
};

/** The messages the rules report for `valid` with `changes` applied. */
function messages(changes: Partial<RateLimitEnvInput>): string[] {
  return envRuleIssues({ ...valid, ...changes }, rateLimitEnvRules).map((issue) => issue.message);
}

describe('rateLimitEnvSchema', () => {
  it('is on by default, defaults the timeout and leaves the rest unset', () => {
    expect(rateLimitEnvSchema.parse({})).toEqual({
      RATE_LIMIT_ENABLED: true,
      RATE_LIMIT_TIMEOUT_MS: 1500,
    });
  });

  it('can be switched off, and only with exactly "false"', () => {
    expect(rateLimitEnvSchema.parse({ RATE_LIMIT_ENABLED: 'false' }).RATE_LIMIT_ENABLED).toBe(
      false,
    );
    expect(rateLimitEnvSchema.safeParse({ RATE_LIMIT_ENABLED: 'off' }).success).toBe(false);
  });

  it('bounds the timeout to 100..10000 ms', () => {
    expect(rateLimitEnvSchema.safeParse({ RATE_LIMIT_TIMEOUT_MS: '99' }).success).toBe(false);
    expect(rateLimitEnvSchema.safeParse({ RATE_LIMIT_TIMEOUT_MS: '10001' }).success).toBe(false);
    expect(rateLimitEnvSchema.parse({ RATE_LIMIT_TIMEOUT_MS: '250' }).RATE_LIMIT_TIMEOUT_MS).toBe(
      250,
    );
  });

  it('knows only the vercel, proxies and none address sources', () => {
    expect(rateLimitEnvSchema.safeParse({ RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'any' }).success).toBe(
      false,
    );
  });
});

describe('nonEmpty and effectiveSecret', () => {
  it('treats an empty value as unset', () => {
    expect(nonEmpty('')).toBeUndefined();
    expect(nonEmpty(undefined)).toBeUndefined();
    expect(nonEmpty('x')).toBe('x');
  });

  it('falls back to AUTH_SECRET when RATE_LIMIT_SECRET is unset or empty', () => {
    expect(effectiveSecret({ ...valid, AUTH_SECRET: 'auth' })).toBe(SECRET);
    expect(effectiveSecret({ ...valid, RATE_LIMIT_SECRET: '', AUTH_SECRET: 'auth' })).toBe('auth');
    expect(effectiveSecret({ ...valid, RATE_LIMIT_SECRET: undefined })).toBeUndefined();
  });
});

describe('effectiveClientAddress', () => {
  it('prefers the explicit source', () => {
    expect(
      effectiveClientAddress({ ...valid, RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'none', VERCEL: '1' }),
    ).toEqual({ source: 'none', configured: true, trustedProxies: [] });
  });

  it('detects vercel from the platform variable', () => {
    expect(effectiveClientAddress({ ...valid, VERCEL: '1' })).toEqual({
      source: 'vercel',
      configured: true,
      trustedProxies: [],
    });
  });

  it('detects proxies from AUTH_TRUSTED_PROXIES and only then keeps them', () => {
    expect(effectiveClientAddress({ ...valid, AUTH_TRUSTED_PROXIES: ['10.0.0.1'] })).toEqual({
      source: 'proxies',
      configured: true,
      trustedProxies: ['10.0.0.1'],
    });
    expect(
      effectiveClientAddress({ ...valid, VERCEL: '1', AUTH_TRUSTED_PROXIES: ['10.0.0.1'] })
        .trustedProxies,
    ).toEqual([]);
  });

  it('is unconfigured when nothing is set or detected, and an empty VERCEL does not count', () => {
    expect(effectiveClientAddress({ ...valid, VERCEL: '' })).toEqual({
      source: 'none',
      configured: false,
      trustedProxies: [],
    });
  });
});

describe('rateLimitEnvRules', () => {
  it('accepts a complete configuration', () => {
    expect(messages({})).toEqual([]);
  });

  it('requires the REST URL and token, treating empty as unset', () => {
    expect(messages({ UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: '' })).toEqual([
      'UPSTASH_REDIS_REST_URL is required.',
      'UPSTASH_REDIS_REST_TOKEN is required.',
    ]);
  });

  it('requires an http(s) REST URL', () => {
    expect(messages({ UPSTASH_REDIS_REST_URL: 'ftp://x.org' })).toEqual([
      'UPSTASH_REDIS_REST_URL must be an http(s) URL.',
    ]);
  });

  it('requires https in production, but only for a valid http(s) URL', () => {
    expect(messages({ NODE_ENV: 'production' })).toEqual([
      'UPSTASH_REDIS_REST_URL must be an https URL when NODE_ENV=production.',
    ]);
    expect(
      messages({ NODE_ENV: 'production', UPSTASH_REDIS_REST_URL: 'https://x.upstash.io' }),
    ).toEqual([]);
    expect(messages({ NODE_ENV: 'production', UPSTASH_REDIS_REST_URL: 'nope' })).toEqual([
      'UPSTASH_REDIS_REST_URL must be an http(s) URL.',
    ]);
    expect(messages({ NODE_ENV: 'production', UPSTASH_REDIS_REST_URL: undefined })).toEqual([
      'UPSTASH_REDIS_REST_URL is required.',
    ]);
  });

  it('requires a key secret of at least 32 characters, with AUTH_SECRET as fallback', () => {
    const weak =
      'RATE_LIMIT_SECRET (or AUTH_SECRET as its fallback) must be at least 32 characters.';
    expect(messages({ RATE_LIMIT_SECRET: 'short' })).toEqual([weak]);
    expect(messages({ RATE_LIMIT_SECRET: undefined })).toEqual([weak]);
    expect(messages({ RATE_LIMIT_SECRET: undefined, AUTH_SECRET: SECRET })).toEqual([]);
  });

  it('requires trusted proxies for an explicit proxies source', () => {
    expect(messages({ RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'proxies' })).toEqual([
      'The "proxies" source needs AUTH_TRUSTED_PROXIES (IPs or CIDR ranges of your proxies).',
    ]);
  });

  it('accepts IPv4/IPv6 addresses and CIDR ranges as trusted proxies', () => {
    expect(
      messages({ AUTH_TRUSTED_PROXIES: ['10.0.0.1', '::1', '10.0.0.0/8', 'fd00::/8'] }),
    ).toEqual([]);
  });

  it('lists malformed trusted proxies by name', () => {
    expect(messages({ AUTH_TRUSTED_PROXIES: ['10.0.0.1', 'proxy.local', '10.0.0.0/99'] })).toEqual([
      'AUTH_TRUSTED_PROXIES contains entries that are not an IP or CIDR range: proxy.local, 10.0.0.0/99.',
    ]);
  });
});
