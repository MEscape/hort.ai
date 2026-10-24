import { afterEach, describe, expect, it, vi } from 'vitest';

async function importServer() {
  vi.resetModules();
  return import('@lib/config/server');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('@lib/config/server', () => {
  it('validates process.env once and exposes the typed server configuration', async () => {
    vi.stubEnv('LOG_LEVEL', 'warn');
    vi.stubEnv('DATABASE_POOL_SIZE', '3');

    const { serverEnv } = await importServer();

    expect(serverEnv.LOG_LEVEL).toBe('warn');
    expect(serverEnv.DATABASE_POOL_SIZE).toBe(3);
    expect(serverEnv.NODE_ENV).toBe('test');
  });

  it('fails at import with variable names but never their values', async () => {
    vi.stubEnv('DATABASE_URL', 'mysql://leaky-user:leaky-password@host/db');

    const failure = await importServer().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    const message = failure instanceof Error ? failure.message : '';
    expect(message).toContain('Invalid server environment configuration');
    expect(message).toContain('DATABASE_URL');
    expect(message).not.toContain('leaky-password');
  });

  it('re-exports the rate-limit settings resolver', async () => {
    const { resolveRateLimitSettings, serverEnv } = await importServer();

    expect(resolveRateLimitSettings(serverEnv).restUrl).toBe('http://localhost:8079');
  });
});
