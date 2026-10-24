import { assertNever, invariant, isDefined } from '@lib/utils';

import { ResendMailTransport } from './resend-mail-transport';
import { SmtpMailTransport } from './smtp-mail-transport';

import type { MailTransport } from './mail-transport';
import type { MailEnv } from '../config/mail-env-schema';

/**
 * Builds the transport the mail settings name, or `null` for `none`. The
 * schema already guarantees what each provider needs; the invariants narrow
 * the types and fail fast if that guarantee is ever removed.
 */
export function createMailTransport(env: MailEnv): MailTransport | null {
  if (env.MAIL_PROVIDER === 'none') {
    return null;
  }

  const { MAIL_FROM: from } = env;
  invariant(isDefined(from), 'MAIL_FROM is required when MAIL_PROVIDER is set.');

  switch (env.MAIL_PROVIDER) {
    case 'smtp': {
      const { MAIL_SMTP_HOST: host } = env;
      invariant(isDefined(host), 'MAIL_SMTP_HOST is required when MAIL_PROVIDER is "smtp".');
      return new SmtpMailTransport({
        host,
        port: env.MAIL_SMTP_PORT,
        secure: env.MAIL_SMTP_SECURE,
        user: env.MAIL_SMTP_USER,
        pass: env.MAIL_SMTP_PASSWORD,
        from,
      });
    }
    case 'resend': {
      const { MAIL_API_KEY: apiKey } = env;
      invariant(isDefined(apiKey), 'MAIL_API_KEY is required when MAIL_PROVIDER is "resend".');
      return new ResendMailTransport({ apiKey, from, apiUrl: env.MAIL_API_URL });
    }
    default:
      return assertNever(env.MAIL_PROVIDER, 'Unsupported MAIL_PROVIDER.');
  }
}
