import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAIL_DELIVERY_FAILED } from '@lib/mail';
import type { OutboundMail } from '@lib/mail';
import { ResendMailTransport } from '@lib/mail/resend-mail-transport';

const API_KEY = 're_secret_api_key_123';
const API_URL = 'https://api.resend.test/emails';

const mail: OutboundMail = {
  to: 'jane@example.org',
  subject: 'Hello',
  text: 'plain',
  html: '<p>html</p>',
};

interface Call {
  readonly url: string;
  readonly init: RequestInit;
  /** The JSON text that was sent. */
  readonly body: string;
}

/** A fetch that records its calls and answers with `respond`. */
function fakeFetch(respond: () => Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init, body: typeof init.body === 'string' ? init.body : '' });
    return respond();
  });
  return calls;
}

/** The one request that was made. */
function only(calls: readonly Call[]): Call {
  const [first] = calls;
  if (calls.length !== 1 || first === undefined) {
    throw new Error(`Expected exactly one request, got ${calls.length}.`);
  }
  return first;
}

const transport = () =>
  new ResendMailTransport({ apiKey: API_KEY, from: 'HortAi <a@b.de>', apiUrl: API_URL });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ResendMailTransport', () => {
  it('posts the mail as JSON with the key as bearer credential', async () => {
    const calls = fakeFetch(async () => new Response('{}', { status: 200 }));

    const result = await transport().send(mail);

    expect(result.isOk()).toBe(true);
    const { url, init, body } = only(calls);
    expect(url).toBe(API_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal?.aborted).toBe(false);
    expect(JSON.parse(body)).toEqual({
      from: 'HortAi <a@b.de>',
      to: ['jane@example.org'],
      subject: 'Hello',
      text: 'plain',
      html: '<p>html</p>',
    });
    expect(body).not.toContain(API_KEY);
  });

  it('sends attachments as base64 text', async () => {
    const calls = fakeFetch(async () => new Response('{}'));
    const ics = 'BEGIN:VCALENDAR\r\nSUMMARY:Grüße\r\nEND:VCALENDAR';

    await transport().send({
      ...mail,
      attachments: [
        { filename: 'a.ics', content: ics, contentType: 'text/calendar; charset=utf-8' },
      ],
    });

    const { body } = only(calls);
    const { attachments } = JSON.parse(body) as {
      attachments: Array<{ filename: string; content: string; content_type: string }>;
    };
    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.filename).toBe('a.ics');
    expect(attachments[0]?.content_type).toBe('text/calendar; charset=utf-8');
    expect(Buffer.from(attachments[0]?.content ?? '', 'base64').toString('utf8')).toBe(ics);
  });

  it('fails with the status only when Resend refuses, never the response body', async () => {
    fakeFetch(async () => new Response(`bad key ${API_KEY} for jane@example.org`, { status: 403 }));

    const result = await transport().send(mail);

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toMatchObject({
      kind: 'infrastructure',
      code: MAIL_DELIVERY_FAILED,
      cause: { status: 403 },
    });
    expect(JSON.stringify(error)).not.toContain(API_KEY);
    expect(JSON.stringify(error)).not.toContain('jane@example.org');
  });

  it('fails with a delivery error when the request itself fails', async () => {
    fakeFetch(async () => {
      throw new TypeError('fetch failed');
    });

    const result = await transport().send(mail);

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'infrastructure',
      code: MAIL_DELIVERY_FAILED,
      message: 'The email could not be delivered.',
    });
    expect(JSON.stringify(result._unsafeUnwrapErr())).not.toContain(API_KEY);
  });
});
