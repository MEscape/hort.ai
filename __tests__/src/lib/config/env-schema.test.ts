import { describe, expect, it } from 'vitest';

import { serverEnvSchema } from '@lib/config/env-schema';

const AZURITE_KEY =
  'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';

const development: Record<string, string | undefined> = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
  AUTH_SECRET: 'a'.repeat(32),
  AUTH_DATABASE_URL: 'postgresql://user:pass@localhost:5432/auth',
  UPSTASH_REDIS_REST_URL: 'http://localhost:8079',
  UPSTASH_REDIS_REST_TOKEN: 'token',
};

const production: Record<string, string | undefined> = {
  ...development,
  NODE_ENV: 'production',
  UPSTASH_REDIS_REST_URL: 'https://redis.example.org',
  MAIL_PROVIDER: 'smtp',
  MAIL_FROM: 'noreply@example.org',
  MAIL_SMTP_HOST: 'smtp.example.org',
  RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'vercel',
};

/** The `variable: message` pairs a failed parse complains about. */
function problems(env: Record<string, string | undefined>): string[] {
  const result = serverEnvSchema.safeParse(env);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${String(issue.path[0])}: ${issue.message}`);
}

describe('serverEnvSchema', () => {
  it('composes the defaults of every domain', () => {
    expect(serverEnvSchema.parse(development)).toMatchObject({
      NODE_ENV: 'development',
      DATABASE_POOL_SIZE: 10,
      DATABASE_POOL_TIMEOUT_SECONDS: 10,
      LOG_LEVEL: 'info',
      AUTH_ENABLED: true,
      MAIL_PROVIDER: 'none',
      STORAGE_PROVIDER: 'none',
      RATE_LIMIT_TIMEOUT_MS: 1500,
    });
  });

  it('requires a PostgreSQL DATABASE_URL and knows only the listed log levels and modes', () => {
    expect(problems({ ...development, DATABASE_URL: undefined })).toHaveLength(1);
    expect(problems({ ...development, LOG_LEVEL: 'trace' })).toHaveLength(1);
    expect(problems({ ...development, NODE_ENV: 'staging' })).toHaveLength(1);
  });

  it('reports the rules of the rate limiter, which read the auth secret', () => {
    expect(problems({ ...development, AUTH_SECRET: undefined, AUTH_ENABLED: 'false' })).toEqual([
      'RATE_LIMIT_SECRET: RATE_LIMIT_SECRET (or AUTH_SECRET as its fallback) must be at least 32 characters.',
    ]);
  });

  it('takes the Alexa demo coupling only as a pair', () => {
    const coupling = { ALEXA_DEMO_GUARDIAN_ID: 'user-1', ALEXA_DEMO_CHILD_PROFILE_ID: 'child-1' };
    const message =
      'ALEXA_DEMO_CHILD_PROFILE_ID: ALEXA_DEMO_GUARDIAN_ID and ALEXA_DEMO_CHILD_PROFILE_ID must be set together.';

    expect(problems({ ...production, ...coupling })).toEqual([]);
    expect(problems({ ...development, ALEXA_DEMO_GUARDIAN_ID: 'user-1' })).toEqual([message]);
    expect(problems({ ...development, ALEXA_DEMO_CHILD_PROFILE_ID: 'child-1' })).toEqual([message]);
  });

  it('accepts a complete production configuration', () => {
    expect(problems(production)).toEqual([]);
  });

  it('refuses disabled auth in production but allows it in development', () => {
    expect(problems({ ...production, AUTH_ENABLED: 'false' })).toEqual([
      'AUTH_ENABLED: AUTH_ENABLED=false is not allowed when NODE_ENV=production.',
    ]);
    expect(problems({ ...development, AUTH_ENABLED: 'false' })).toEqual([]);
  });

  it('needs no rate-limit settings while limiting is off, and refuses that in production', () => {
    const off = {
      ...development,
      RATE_LIMIT_ENABLED: 'false',
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
      RATE_LIMIT_SECRET: undefined,
      AUTH_ENABLED: 'false',
      AUTH_SECRET: undefined,
    };

    expect(problems(off)).toEqual([]);
    expect(problems({ ...production, RATE_LIMIT_ENABLED: 'false' })).toEqual([
      'RATE_LIMIT_ENABLED: RATE_LIMIT_ENABLED=false is not allowed when NODE_ENV=production.',
    ]);
  });

  it('requires a real mail provider in production', () => {
    expect(problems({ ...production, MAIL_PROVIDER: 'none' })).toEqual([
      'MAIL_PROVIDER: MAIL_PROVIDER must be "smtp" or "resend" in production: sign-in sends e-mail.',
    ]);
  });

  it('allows Resend only in production', () => {
    const resend = { MAIL_PROVIDER: 'resend', MAIL_FROM: 'a@b.de', MAIL_API_KEY: 'key' };

    expect(problems({ ...development, ...resend })).toEqual([
      'MAIL_PROVIDER: MAIL_PROVIDER must be "none" or "smtp" outside production.',
    ]);
    expect(problems({ ...production, ...resend })).toEqual([]);
  });

  it('requires an https Resend API URL in production', () => {
    const resend = { MAIL_PROVIDER: 'resend', MAIL_FROM: 'a@b.de', MAIL_API_KEY: 'key' };

    expect(problems({ ...production, ...resend, MAIL_API_URL: 'http://mail.example.org' })).toEqual(
      ['MAIL_API_URL: MAIL_API_URL must be an https URL in production.'],
    );
  });

  it('requires https storage URLs in production, and leaves unset ones alone', () => {
    const azure = {
      STORAGE_PROVIDER: 'azure',
      STORAGE_AZURE_ACCOUNT_NAME: 'account',
      STORAGE_AZURE_ACCOUNT_KEY: AZURITE_KEY,
      STORAGE_AZURE_PRIVATE_CONTAINER: 'private-files',
    };

    expect(problems({ ...production, ...azure })).toEqual([]);
    expect(
      problems({
        ...production,
        ...azure,
        STORAGE_AZURE_PUBLIC_CONTAINER: 'public-files',
        STORAGE_AZURE_BLOB_ENDPOINT: 'http://blob.example.org',
        STORAGE_PUBLIC_BASE_URL: 'http://cdn.example.org',
      }),
    ).toEqual([
      'STORAGE_AZURE_BLOB_ENDPOINT: STORAGE_AZURE_BLOB_ENDPOINT must be an https URL in production.',
      'STORAGE_PUBLIC_BASE_URL: STORAGE_PUBLIC_BASE_URL must be an https URL in production.',
    ]);
  });

  it('sends the speech key and recordings only over https in production', () => {
    expect(problems({ ...production, ELEVENLABS_API_URL: 'http://speech.example.org' })).toEqual([
      'ELEVENLABS_API_URL: ELEVENLABS_API_URL must be an https URL in production.',
    ]);
    expect(problems({ ...development, ELEVENLABS_API_URL: 'http://localhost:9000' })).toEqual([]);
  });

  it("sends the AI key and the child's task text only over https in production", () => {
    expect(problems({ ...production, GEMINI_API_URL: 'http://ai.example.org' })).toEqual([
      'GEMINI_API_URL: GEMINI_API_URL must be an https URL in production.',
    ]);
    expect(problems({ ...development, GEMINI_API_URL: 'http://localhost:9001' })).toEqual([]);
    expect(problems({ ...production, TYPESAFE_API_URL: 'http://jev.example.org' })).toEqual([
      'TYPESAFE_API_URL: TYPESAFE_API_URL must be an https URL in production.',
    ]);
  });

  it('requires the Jev safety classifier wherever Gemini answers children in production', () => {
    const gemini = { GEMINI_API_KEY: 'g'.repeat(32) };

    expect(problems({ ...production, ...gemini })).toEqual([
      'TYPESAFE_API_KEY: TYPESAFE_API_KEY is required in production when GEMINI_API_KEY is set: every AI text needs the second safety check.',
    ]);
    expect(problems({ ...production, ...gemini, TYPESAFE_API_KEY: 't'.repeat(32) })).toEqual([]);
    expect(problems({ ...development, ...gemini })).toEqual([]);
  });

  it('requires a deliberate client-address source in production', () => {
    const unset = { ...production, RATE_LIMIT_CLIENT_ADDRESS_SOURCE: undefined };

    expect(problems(unset)).toEqual([
      'RATE_LIMIT_CLIENT_ADDRESS_SOURCE: Set RATE_LIMIT_CLIENT_ADDRESS_SOURCE (or AUTH_TRUSTED_PROXIES) in production; otherwise every budget per client address is silently off.',
    ]);
    expect(problems({ ...unset, RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'none' })).toEqual([]);
    expect(problems({ ...unset, AUTH_TRUSTED_PROXIES: '10.0.0.0/8' })).toEqual([]);
    expect(problems({ ...unset, VERCEL: '1' })).toEqual([]);
    expect(problems({ ...development })).toEqual([]);
  });

  it('does not require https for storage URLs outside production', () => {
    expect(
      problems({
        ...development,
        STORAGE_PROVIDER: 'azure',
        STORAGE_AZURE_ACCOUNT_NAME: 'account',
        STORAGE_AZURE_ACCOUNT_KEY: AZURITE_KEY,
        STORAGE_AZURE_PRIVATE_CONTAINER: 'private-files',
        STORAGE_AZURE_BLOB_ENDPOINT: 'http://127.0.0.1:10000/account',
      }),
    ).toEqual([]);
  });
});
