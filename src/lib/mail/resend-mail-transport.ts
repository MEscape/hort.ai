import type { InfrastructureAppError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { mailDeliveryFailed } from './mail-errors';

import type { MailTransport, OutboundMail } from './mail-transport';

const REQUEST_TIMEOUT_MS = 10_000;

export interface ResendMailTransportOptions {
  readonly apiKey: string;
  /** Verified sender, e.g. `HortAi <no-reply@example.org>`. */
  readonly from: string;
  /** Explicit URL to Resend's API (e.g. 'https://api.resend.com/emails') */
  readonly apiUrl: string;
}

/**
 * Sends through Resend's HTTP API with the platform `fetch`, so no SDK is
 * added (dependencies.md). Failures carry the status only: the response
 * body is never copied into an error, and the API key never leaves the
 * request header.
 */
export class ResendMailTransport implements MailTransport {
  constructor(private readonly options: ResendMailTransportOptions) {}

  send(mail: OutboundMail): AppResultAsync<void, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        fetch(this.options.apiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.options.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.options.from,
            to: [mail.to],
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
            // Resend takes attachments as base64 text.
            attachments: mail.attachments?.map(({ filename, content, contentType }) => ({
              filename,
              content: Buffer.from(content, 'utf8').toString('base64'),
              content_type: contentType,
            })),
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }),
      mailDeliveryFailed,
    ).andThen((response): AppResultAsync<void, InfrastructureAppError> =>
      response.ok ? okAsync(undefined) : errAsync(mailDeliveryFailed({ status: response.status })),
    );
  }
}
