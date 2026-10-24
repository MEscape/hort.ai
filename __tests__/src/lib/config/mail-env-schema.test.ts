import { describe, expect, it } from 'vitest';

import { mailEnvSchema } from '@lib/config/mail-env-schema';

/** The variables a failed parse complains about. */
function problems(env: Record<string, string | undefined>): string[] {
  const result = mailEnvSchema.safeParse(env);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
}

describe('mailEnvSchema', () => {
  it('defaults to no mail at all', () => {
    expect(mailEnvSchema.parse({})).toMatchObject({
      MAIL_PROVIDER: 'none',
      MAIL_API_URL: 'https://api.resend.com/emails',
      MAIL_SMTP_PORT: 1025,
      MAIL_SMTP_SECURE: false,
    });
  });

  it('accepts complete Resend and SMTP configurations', () => {
    expect(problems({ MAIL_PROVIDER: 'resend', MAIL_FROM: 'a@b.de', MAIL_API_KEY: 'key' })).toEqual(
      [],
    );
    expect(
      problems({
        MAIL_PROVIDER: 'smtp',
        MAIL_FROM: 'a@b.de',
        MAIL_SMTP_HOST: 'localhost',
        MAIL_SMTP_USER: 'u',
        MAIL_SMTP_PASSWORD: 'p',
      }),
    ).toEqual([]);
    expect(
      problems({ MAIL_PROVIDER: 'smtp', MAIL_FROM: 'a@b.de', MAIL_SMTP_HOST: 'localhost' }),
    ).toEqual([]);
  });

  it('requires the Resend API key and a sender', () => {
    expect(problems({ MAIL_PROVIDER: 'resend' })).toEqual(['MAIL_API_KEY', 'MAIL_FROM']);
  });

  it('requires the SMTP host and a sender', () => {
    expect(problems({ MAIL_PROVIDER: 'smtp' })).toEqual(['MAIL_SMTP_HOST', 'MAIL_FROM']);
  });

  it('requires SMTP credentials to be set together', () => {
    const smtp = { MAIL_PROVIDER: 'smtp', MAIL_FROM: 'a@b.de', MAIL_SMTP_HOST: 'h' };
    expect(problems({ ...smtp, MAIL_SMTP_PASSWORD: 'p' })).toEqual(['MAIL_SMTP_USER']);
    expect(problems({ ...smtp, MAIL_SMTP_USER: 'u' })).toEqual(['MAIL_SMTP_PASSWORD']);
  });

  it('ignores provider settings while no provider is chosen', () => {
    expect(problems({ MAIL_SMTP_PASSWORD: 'p' })).toEqual([]);
  });

  it('bounds the SMTP port to a TCP port and the API URL to http(s)', () => {
    expect(problems({ MAIL_SMTP_PORT: '65536' })).toEqual(['MAIL_SMTP_PORT']);
    expect(problems({ MAIL_API_URL: 'ftp://x.org' })).toEqual(['MAIL_API_URL']);
  });
});
