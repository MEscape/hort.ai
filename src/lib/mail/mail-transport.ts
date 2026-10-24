import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

/** A file sent with a message, as text: a calendar entry is the one kind so far. */
export interface MailAttachment {
  readonly filename: string;
  readonly content: string;
  /** The media type, with parameters a client needs (`text/calendar; charset=utf-8; method=PUBLISH`). */
  readonly contentType: string;
}

/** A fully rendered message. May contain single-use links: never log it. */
export interface OutboundMail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly attachments?: readonly MailAttachment[];
}

/**
 * How bytes leave the building. Modules own their messages (copy, subject,
 * who gets what); this only delivers one. Swapping the provider (SMTP, SES,
 * Resend) means writing one class that implements this.
 */
export interface MailTransport {
  send(mail: OutboundMail): AppResultAsync<void, InfrastructureAppError>;
}
