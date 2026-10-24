import nodemailer from 'nodemailer';

import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { mailDeliveryFailed } from './mail-errors';

import type { MailTransport, OutboundMail } from './mail-transport';
import type { Transporter } from 'nodemailer';

/**
 * Nodemailer's own limits are two minutes to connect and ten to idle, which would hold a sign-in
 * request open that long behind an unreachable relay. Matches the Resend transport's bound.
 */
const SMTP_TIMEOUT_MS = 10_000;

export interface SmtpMailTransportOptions {
  /** SMTP server hostname, e.g. `localhost` for Mailpit. */
  readonly host: string;
  /** SMTP server port, e.g. `1025` for Mailpit. */
  readonly port: number;
  /** Sender address, e.g. `HortAi <no-reply@example.org>`. */
  readonly from: string;
  /** Optional SMTP authentication username. */
  readonly user?: string | undefined;
  /** Optional SMTP authentication password. */
  readonly pass?: string | undefined;
  /** Whether to use TLS. Usually false for a local catcher. */
  readonly secure?: boolean;
}

/**
 * What a failed send may say about itself. Nodemailer's own message quotes the recipient and the
 * server's reply (`550 5.1.1 <jane@example.org> user unknown`), and a logged cause prints its stack,
 * which starts with that message: the log gets the failure's codes only.
 */
function describeFailure(thrown: unknown): Error {
  const fields: object = typeof thrown === 'object' && thrown !== null ? thrown : {};
  const codes = ['code', 'responseCode', 'command']
    .map((field): unknown => Reflect.get(fields, field))
    .filter((value) => typeof value === 'string' || typeof value === 'number');
  return new Error(['SMTP delivery failed', ...codes].join(' '));
}

/**
 * Sends email through an SMTP server using Nodemailer. Supports optional
 * SMTP authentication and is suitable for local development with Mailpit.
 * Delivery failures are mapped to the shared `mailDeliveryFailed` error, with a cause that names
 * the failure's codes but never the recipient.
 */
export class SmtpMailTransport implements MailTransport {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(options: SmtpMailTransportOptions) {
    this.from = options.from;

    const auth =
      options.user && options.pass ? { user: options.user, pass: options.pass } : undefined;

    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure ?? false,
      // Credentials must never cross the network in the clear: refuse a relay that does not offer
      // STARTTLS, or whose offer was stripped on the way, instead of authenticating without it.
      requireTLS: auth !== undefined,
      auth,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    });
  }

  send(mail: OutboundMail): AppResultAsync<void, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => {
        await this.transporter.sendMail({
          from: this.from,
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          attachments: mail.attachments?.map(({ filename, content, contentType }) => ({
            filename,
            content,
            contentType,
          })),
        });
      },
      (thrown) => mailDeliveryFailed(describeFailure(thrown)),
    ).andThen(() => okAsync(undefined));
  }
}
