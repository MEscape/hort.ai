import { afterEach, describe, expect, it, vi } from 'vitest';

async function importServer() {
  vi.resetModules();
  return import('@lib/mail/server');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('getMailTransport', () => {
  it('is null while MAIL_PROVIDER=none', async () => {
    vi.stubEnv('MAIL_PROVIDER', 'none');

    const { getMailTransport } = await importServer();

    expect(getMailTransport()).toBeNull();
  });

  it('builds the configured transport once and reuses it', async () => {
    vi.stubEnv('MAIL_PROVIDER', 'smtp');
    vi.stubEnv('MAIL_FROM', 'HortAi <no-reply@example.org>');
    vi.stubEnv('MAIL_SMTP_HOST', 'localhost');

    const { getMailTransport } = await importServer();

    const transport = getMailTransport();
    expect(transport).not.toBeNull();
    expect(getMailTransport()).toBe(transport);
  });
});
