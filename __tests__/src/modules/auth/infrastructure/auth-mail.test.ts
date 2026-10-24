import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deliverAuthEmail } from '@modules/auth/infrastructure/better-auth/deliver-auth-email';
import { renderAuthEmail } from '@modules/auth/infrastructure/mail/auth-email-templates';
import type { AuthEmailKind } from '@modules/auth/infrastructure/mail/auth-email-templates';
import { TransactionalAuthMailer } from '@modules/auth/infrastructure/mail/transactional-auth-mailer';

import { infrastructureError } from '@lib/errors';
import type { MailTransport, OutboundMail } from '@lib/mail';
import { errAsync, okAsync } from '@lib/result';

const LINK = 'https://lumio.example/en/reset-password?token=SINGLE-USE-TOKEN&x=1';
const KINDS: readonly AuthEmailKind[] = ['verification', 'password_reset', 'existing_account'];

describe('renderAuthEmail', () => {
  it.each(
    KINDS.flatMap((kind) => (['de', 'en'] as const).map((locale) => [kind, locale] as const)),
  )(
    'renders %s in %s completely: a subject, the link in both parts, no placeholder left',
    (kind, locale) => {
      const mail = renderAuthEmail({ kind, locale, appName: 'Lumio', url: LINK });

      expect(mail.subject.length).toBeGreaterThan(0);
      expect(mail.text).toContain(LINK);
      expect(mail.html).toContain('SINGLE-USE-TOKEN');
      for (const part of [mail.subject, mail.text, mail.html]) {
        expect(part).not.toMatch(/\{(appName|minutes|days|name)\}/);
      }
    },
  );

  it('states how long a verification or reset link stays valid', () => {
    expect(
      renderAuthEmail({ kind: 'verification', locale: 'en', appName: 'Lumio', url: LINK }).text,
    ).toContain('60 minutes');
    expect(
      renderAuthEmail({ kind: 'password_reset', locale: 'de', appName: 'Lumio', url: LINK }).text,
    ).toContain('60 Minuten');
  });

  it('greets by the name on the account, and not at all without one', () => {
    const named = renderAuthEmail({
      kind: 'verification',
      locale: 'en',
      appName: 'Lumio',
      url: LINK,
      name: 'Mara',
    });
    const anonymous = renderAuthEmail({
      kind: 'verification',
      locale: 'en',
      appName: 'Lumio',
      url: LINK,
    });

    expect(named.text).toContain('Hello Mara,');
    expect(anonymous.text).not.toContain('Hello');
  });

  it('escapes a name that is markup, so a sign-up cannot inject HTML into a mail', () => {
    const mail = renderAuthEmail({
      kind: 'verification',
      locale: 'en',
      appName: 'Lumio',
      url: LINK,
      name: '<script>alert(1)</script>',
    });

    expect(mail.html).not.toContain('<script>alert(1)</script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('never mentions a password or a way to learn one', () => {
    for (const kind of KINDS) {
      const { text } = renderAuthEmail({ kind, locale: 'en', appName: 'Lumio', url: LINK });
      expect(text).not.toMatch(/your password is/i);
    }
  });
});

function recordingTransport(failure: ReturnType<typeof infrastructureError> | null = null) {
  const sent: OutboundMail[] = [];
  const transport: MailTransport = {
    send: (mail) => {
      sent.push(mail);
      return failure === null ? okAsync(undefined) : errAsync(failure);
    },
  };
  return { transport, sent };
}

const SETTINGS = {
  appName: 'Lumio',
  signInLink: (locale: string) => `https://lumio.example/${locale}/sign-in`,
};

describe('TransactionalAuthMailer', () => {
  it('sends a verification mail to the account address with the provider link', async () => {
    const { transport, sent } = recordingTransport();

    const result = await new TransactionalAuthMailer(transport, SETTINGS).sendVerification({
      to: 'mara@example.org',
      url: LINK,
      locale: 'en',
      name: 'Mara',
    });

    expect(result.isOk()).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'mara@example.org' });
    expect(sent[0]?.text).toContain(LINK);
  });

  it('sends a reset mail that carries the provider link', async () => {
    const { transport, sent } = recordingTransport();

    await new TransactionalAuthMailer(transport, SETTINGS).sendPasswordReset({
      to: 'mara@example.org',
      url: LINK,
      locale: 'de',
    });

    expect(sent[0]?.text).toContain(LINK);
  });

  it('points the notice about an existing account at the sign-in page, in the locale it is given', async () => {
    const { transport, sent } = recordingTransport();

    await new TransactionalAuthMailer(transport, SETTINGS).sendExistingAccountNotice({
      to: 'mara@example.org',
      locale: 'de',
    });

    expect(sent[0]?.text).toContain('https://lumio.example/de/sign-in');
    expect(sent[0]?.text).not.toContain('token=');
  });

  it('reports a transport failure as its own delivery error, keeping the transport error as the cause', async () => {
    const cause = infrastructureError('mail.delivery_failed', 'smtp 550 mailbox unavailable');
    const { transport } = recordingTransport(cause);

    const result = await new TransactionalAuthMailer(transport, SETTINGS).sendVerification({
      to: 'mara@example.org',
      url: LINK,
      locale: 'en',
    });

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'infrastructure',
      code: 'auth.mail_delivery_failed',
      cause,
    });
    expect(result.isErr() && result.error.message).not.toContain('550');
  });
});

describe('deliverAuthEmail', () => {
  let lines: string[];

  beforeEach(() => {
    lines = [];
    for (const channel of ['log', 'info', 'warn', 'error'] as const) {
      vi.spyOn(console, channel).mockImplementation((line: unknown) => {
        lines.push(String(line));
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves quietly when the mail was sent', async () => {
    await expect(deliverAuthEmail(okAsync(undefined), 'verification')).resolves.toBeUndefined();

    expect(lines).toEqual([]);
  });

  it('resolves when delivery failed, so a failure cannot tell a known address from an unknown one', async () => {
    const failure = infrastructureError(
      'auth.mail_delivery_failed',
      'The authentication email could not be delivered.',
    );

    await expect(deliverAuthEmail(errAsync(failure), 'existing_account')).resolves.toBeUndefined();
  });

  it('logs the failure once, by kind, without the link or the address', async () => {
    const failure = infrastructureError(
      'auth.mail_delivery_failed',
      'The authentication email could not be delivered.',
    );

    await deliverAuthEmail(errAsync(failure), 'password_reset');

    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0] ?? '{}') as {
      message: string;
      context: Record<string, unknown>;
      error: { name: string; message: string };
    };
    expect(line.message).toBe('auth.email_delivery_failed');
    expect(line.context).toMatchObject({ module: 'auth.mail', kind: 'password_reset' });
    // The error is named by our own kind and code, not as "[object Object]".
    expect(line.error).toMatchObject({
      name: 'infrastructure',
      message: 'auth.mail_delivery_failed',
    });
    expect(lines[0]).not.toContain('token');
  });
});
