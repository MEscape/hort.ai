import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAIL_DELIVERY_FAILED } from '@lib/mail';
import type { OutboundMail } from '@lib/mail';
import { SmtpMailTransport } from '@lib/mail/smtp-mail-transport';

interface FakeNodemailer {
  options: unknown[];
  sent: unknown[];
  failWith: unknown;
  shouldFail: boolean;
}

const nodemailer = vi.hoisted((): FakeNodemailer => ({
  options: [],
  sent: [],
  failWith: undefined,
  shouldFail: false,
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (options: unknown) => {
      nodemailer.options.push(options);
      return {
        sendMail: async (message: unknown) => {
          if (nodemailer.shouldFail) {
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- a relay can fail with any value; the test needs that
            return Promise.reject(nodemailer.failWith);
          }
          nodemailer.sent.push(message);
        },
      };
    },
  },
}));

const mail: OutboundMail = {
  to: 'jane@example.org',
  subject: 'Hello',
  text: 'plain',
  html: '<p>html</p>',
};

const base = { host: 'smtp.example.org', port: 587, from: 'HortAi <a@b.de>' };

beforeEach(() => {
  nodemailer.options.length = 0;
  nodemailer.sent.length = 0;
  nodemailer.shouldFail = false;
});

/** The error of a send that fails with `thrown`. */
async function failure(thrown: unknown) {
  nodemailer.shouldFail = true;
  nodemailer.failWith = thrown;
  const result = await new SmtpMailTransport(base).send(mail);
  return result._unsafeUnwrapErr();
}

describe('SmtpMailTransport configuration', () => {
  it('connects without authentication or TLS requirement for a local catcher', () => {
    new SmtpMailTransport({ host: 'localhost', port: 1025, from: 'a@b.de' });

    expect(nodemailer.options).toEqual([
      {
        host: 'localhost',
        port: 1025,
        secure: false,
        requireTLS: false,
        auth: undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 10_000,
      },
    ]);
  });

  it('requires STARTTLS whenever credentials are sent', () => {
    new SmtpMailTransport({ ...base, secure: true, user: 'u', pass: 'p' });

    expect(nodemailer.options[0]).toMatchObject({
      secure: true,
      requireTLS: true,
      auth: { user: 'u', pass: 'p' },
    });
  });

  it('sends no credentials when only half of them are set', () => {
    new SmtpMailTransport({ ...base, user: 'u' });
    new SmtpMailTransport({ ...base, pass: 'p' });

    expect(nodemailer.options).toMatchObject([
      { requireTLS: false, auth: undefined },
      { requireTLS: false, auth: undefined },
    ]);
  });
});

describe('SmtpMailTransport.send', () => {
  it('hands the message to the relay with the configured sender', async () => {
    const result = await new SmtpMailTransport(base).send(mail);

    expect(result.isOk()).toBe(true);
    expect(nodemailer.sent).toEqual([{ ...mail, from: base.from, attachments: undefined }]);
  });

  it('passes attachments with filename, content and type only', async () => {
    const attachment = { filename: 'a.ics', content: 'BEGIN', contentType: 'text/calendar' };

    await new SmtpMailTransport(base).send({ ...mail, attachments: [attachment] });

    expect(nodemailer.sent).toMatchObject([{ attachments: [attachment] }]);
  });

  it('reports a failure by its codes, never by the recipient or the server reply', async () => {
    const thrown = Object.assign(new Error('550 5.1.1 <jane@example.org> user unknown'), {
      code: 'EENVELOPE',
      responseCode: 550,
      command: 'RCPT TO',
      response: '550 5.1.1 <jane@example.org> user unknown',
    });

    const error = await failure(thrown);

    expect(error).toMatchObject({ kind: 'infrastructure', code: MAIL_DELIVERY_FAILED });
    expect(error.cause).toEqual(new Error('SMTP delivery failed EENVELOPE 550 RCPT TO'));
    expect(JSON.stringify(error)).not.toContain('jane@example.org');
    expect(String((error.cause as Error).stack)).not.toContain('jane@example.org');
  });

  it('ignores fields that are not text or numbers', async () => {
    const error = await failure({ code: { nested: true }, responseCode: null, command: 'AUTH' });

    expect((error.cause as Error).message).toBe('SMTP delivery failed AUTH');
  });

  it.each([['boom'], [null], [undefined], [42]])(
    'still fails cleanly when %j is thrown',
    async (thrown) => {
      const error = await failure(thrown);

      expect((error.cause as Error).message).toBe('SMTP delivery failed');
    },
  );
});
