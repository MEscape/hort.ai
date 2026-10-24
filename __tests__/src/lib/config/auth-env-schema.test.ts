import { describe, expect, it } from 'vitest';

import { authEnvSchema } from '@lib/config/auth-env-schema';

const SECRET = 's'.repeat(32);
const DAY = 86_400;

const valid = {
  AUTH_SECRET: SECRET,
  AUTH_DATABASE_URL: 'postgresql://user:pass@localhost:5432/auth',
};

/** The variables a failed parse complains about. */
function problems(env: Record<string, string | undefined>): string[] {
  const result = authEnvSchema.safeParse(env);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
}

describe('authEnvSchema defaults', () => {
  it('enables auth and applies the session defaults', () => {
    expect(authEnvSchema.parse(valid)).toMatchObject({
      AUTH_ENABLED: true,
      AUTH_DATABASE_POOL_SIZE: 5,
      AUTH_SESSION_EXPIRES_IN_SECONDS: 7 * DAY,
      AUTH_SESSION_UPDATE_AGE_SECONDS: DAY,
      AUTH_SESSION_FRESH_AGE_SECONDS: 900,
      AUTH_SESSION_MAX_LIFETIME_SECONDS: 30 * DAY,
      AUTH_TRUSTED_PROXIES: [],
      AUTH_PLATFORM_ADMIN_EMAILS: [],
      AUTH_DEV_ACTOR_ROLE: 'viewer',
    });
  });

  it('lower-cases platform admin e-mails and splits proxies', () => {
    const parsed = authEnvSchema.parse({
      ...valid,
      AUTH_PLATFORM_ADMIN_EMAILS: 'Admin@Example.org, ops@example.org',
      AUTH_TRUSTED_PROXIES: '10.0.0.1, 10.0.0.0/8',
    });

    expect(parsed.AUTH_PLATFORM_ADMIN_EMAILS).toEqual(['admin@example.org', 'ops@example.org']);
    expect(parsed.AUTH_TRUSTED_PROXIES).toEqual(['10.0.0.1', '10.0.0.0/8']);
  });

  it('rejects a malformed platform admin e-mail', () => {
    expect(problems({ ...valid, AUTH_PLATFORM_ADMIN_EMAILS: 'not-an-email' })).toEqual([
      'AUTH_PLATFORM_ADMIN_EMAILS',
    ]);
  });
});

describe('authEnvSchema while auth is enabled', () => {
  it('requires a secret of at least 32 characters', () => {
    expect(problems({ ...valid, AUTH_SECRET: undefined })).toEqual(['AUTH_SECRET']);
    expect(problems({ ...valid, AUTH_SECRET: 's'.repeat(31) })).toEqual(['AUTH_SECRET']);
  });

  it('requires the auth database URL', () => {
    expect(problems({ ...valid, AUTH_DATABASE_URL: undefined })).toEqual(['AUTH_DATABASE_URL']);
  });

  it('keeps update and fresh age within the session lifetime', () => {
    expect(
      problems({
        ...valid,
        AUTH_SESSION_EXPIRES_IN_SECONDS: '100',
        AUTH_SESSION_UPDATE_AGE_SECONDS: '101',
        AUTH_SESSION_FRESH_AGE_SECONDS: '101',
        AUTH_SESSION_MAX_LIFETIME_SECONDS: '100',
      }),
    ).toEqual(['AUTH_SESSION_UPDATE_AGE_SECONDS', 'AUTH_SESSION_FRESH_AGE_SECONDS']);
  });

  it('keeps the maximum lifetime at or above the session lifetime', () => {
    expect(
      problems({
        ...valid,
        AUTH_SESSION_EXPIRES_IN_SECONDS: '100',
        AUTH_SESSION_UPDATE_AGE_SECONDS: '50',
        AUTH_SESSION_FRESH_AGE_SECONDS: '50',
        AUTH_SESSION_MAX_LIFETIME_SECONDS: '99',
      }),
    ).toEqual(['AUTH_SESSION_MAX_LIFETIME_SECONDS']);
  });
});

describe('authEnvSchema while auth is disabled', () => {
  it('ignores every rule', () => {
    expect(
      problems({ AUTH_ENABLED: 'false', AUTH_SESSION_UPDATE_AGE_SECONDS: '999999999' }),
    ).toEqual([]);
  });
});
