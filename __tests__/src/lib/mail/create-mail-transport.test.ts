import { describe, expect, it } from 'vitest';

import type { MailEnv } from '@lib/config/mail-env-schema';
import { createMailTransport } from '@lib/mail/create-mail-transport';
import { ResendMailTransport } from '@lib/mail/resend-mail-transport';
import { SmtpMailTransport } from '@lib/mail/smtp-mail-transport';

const base: MailEnv = {
  MAIL_PROVIDER: 'none',
  MAIL_API_URL: 'https://api.resend.com/emails',
  MAIL_SMTP_PORT: 1025,
  MAIL_SMTP_SECURE: false,
};

describe('createMailTransport', () => {
  it('builds nothing while no provider is chosen', () => {
    expect(createMailTransport(base)).toBeNull();
  });

  it('builds an SMTP transport', () => {
    const env: MailEnv = {
      ...base,
      MAIL_PROVIDER: 'smtp',
      MAIL_FROM: 'a@b.de',
      MAIL_SMTP_HOST: 'h',
    };

    expect(createMailTransport(env)).toBeInstanceOf(SmtpMailTransport);
  });

  it('builds a Resend transport', () => {
    const env: MailEnv = {
      ...base,
      MAIL_PROVIDER: 'resend',
      MAIL_FROM: 'a@b.de',
      MAIL_API_KEY: 'key',
    };

    expect(createMailTransport(env)).toBeInstanceOf(ResendMailTransport);
  });

  it.each([
    ['smtp', { MAIL_SMTP_HOST: 'h' }, 'MAIL_FROM is required when MAIL_PROVIDER is set.'],
    ['smtp', { MAIL_FROM: 'a@b.de' }, 'MAIL_SMTP_HOST is required when MAIL_PROVIDER is "smtp".'],
    ['resend', { MAIL_FROM: 'a@b.de' }, 'MAIL_API_KEY is required when MAIL_PROVIDER is "resend".'],
  ] as const)('fails fast for %s without what it needs: %j', (provider, rest, message) => {
    expect(() => createMailTransport({ ...base, MAIL_PROVIDER: provider, ...rest })).toThrow(
      message,
    );
  });

  it('refuses a provider it does not know', () => {
    // A value the schema would have refused: this is the guard for when the two drift apart.
    const env = { ...base, MAIL_PROVIDER: 'ses', MAIL_FROM: 'a@b.de' } as unknown as MailEnv;

    expect(() => createMailTransport(env)).toThrow('Unsupported MAIL_PROVIDER.');
  });
});
