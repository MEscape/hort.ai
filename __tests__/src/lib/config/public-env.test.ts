import { afterEach, describe, expect, it, vi } from 'vitest';

async function importConfig() {
  vi.resetModules();
  return import('@lib/config');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('publicEnv', () => {
  it('defaults the app URL to the local development origin', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', undefined);

    const { publicEnv } = await importConfig();

    expect(publicEnv).toEqual({ NEXT_PUBLIC_APP_URL: 'http://localhost:3000' });
  });

  it('reads NEXT_PUBLIC_APP_URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.org');

    const { publicEnv } = await importConfig();

    expect(publicEnv.NEXT_PUBLIC_APP_URL).toBe('https://app.example.org');
  });

  it('fails at import for a URL that is not http(s), naming the variable', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'javascript:alert(1)');

    await expect(importConfig()).rejects.toThrow(
      /Invalid public environment configuration:\n {2}- NEXT_PUBLIC_APP_URL: Must be an http\(s\) URL\./,
    );
  });

  it('exposes the app identity through the barrel', async () => {
    const { APP_IDENTITY } = await importConfig();

    expect(APP_IDENTITY.name).toBe('Hort.ai');
  });
});
