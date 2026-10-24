import { describe, expect, it } from 'vitest';

import { rateLimitEnvSchema } from '@lib/config/rate-limit-env-schema';
import type { RateLimitEnvInput } from '@lib/config/rate-limit-env-schema';
import { resolveRateLimitSettings } from '@lib/config/rate-limit-settings';

const env: RateLimitEnvInput = {
  ...rateLimitEnvSchema.parse({}),
  NODE_ENV: 'development',
  UPSTASH_REDIS_REST_URL: 'http://localhost:8079',
  UPSTASH_REDIS_REST_TOKEN: 'token',
  RATE_LIMIT_SECRET: 'r'.repeat(32),
};

describe('resolveRateLimitSettings', () => {
  it('builds the limiter settings from the validated environment', () => {
    expect(resolveRateLimitSettings({ ...env, AUTH_TRUSTED_PROXIES: ['10.0.0.1'] })).toEqual({
      restUrl: 'http://localhost:8079',
      restToken: 'token',
      keySecret: 'r'.repeat(32),
      timeoutMs: 1500,
      clientAddress: { source: 'proxies', configured: true, trustedProxies: ['10.0.0.1'] },
    });
  });

  it('falls back to AUTH_SECRET as key secret', () => {
    const settings = resolveRateLimitSettings({
      ...env,
      RATE_LIMIT_SECRET: undefined,
      AUTH_SECRET: 'a'.repeat(32),
    });

    expect(settings.keySecret).toBe('a'.repeat(32));
  });

  it.each([
    ['URL', { UPSTASH_REDIS_REST_URL: undefined }],
    ['token', { UPSTASH_REDIS_REST_TOKEN: '' }],
    ['secret', { RATE_LIMIT_SECRET: undefined }],
  ])('refuses a missing %s', (_name, changes) => {
    expect(() => resolveRateLimitSettings({ ...env, ...changes })).toThrow(
      'Invalid rate-limit configuration: Upstash URL, token or secret missing.',
    );
  });
});
