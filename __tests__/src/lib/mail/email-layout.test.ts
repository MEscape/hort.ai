import { describe, expect, it } from 'vitest';

import { APP_IDENTITY, publicEnv } from '@lib/config';
import { renderEmail } from '@lib/mail';
import type { EmailContent } from '@lib/mail';

const minimal: EmailContent = {
  locale: 'en',
  title: 'Welcome',
  intro: 'Thanks for joining.',
  outro: 'Ignore this if it was not you.',
};

describe('renderEmail without optional parts', () => {
  const rendered = renderEmail(minimal);

  it('uses the title as the subject', () => {
    expect(rendered.subject).toBe('Welcome');
    expect(rendered.html).toContain('<title>Welcome</title>');
  });

  it('writes intro and outro as the plain-text paragraphs', () => {
    expect(rendered.text).toBe('Thanks for joining.\n\nIgnore this if it was not you.');
  });

  it('renders a complete light-only document in the given language', () => {
    expect(rendered.html).toMatch(/^<!doctype html><html lang="en">/);
    expect(rendered.html).toContain('<meta charset="utf-8">');
    expect(rendered.html).toContain('<meta name="color-scheme" content="light">');
    expect(rendered.html).toContain(`<h1 `);
    expect(rendered.html).toContain('>Welcome</h1>');
  });

  it('draws the logo from the app origin and credits the product', () => {
    expect(rendered.html).toContain(`src="${publicEnv.NEXT_PUBLIC_APP_URL}/email/hortai.png"`);
    expect(rendered.html).toContain(`alt="${APP_IDENTITY.name}"`);
    expect(rendered.html).toContain('width="248" height="80"');
    expect(rendered.html).toContain(`>${APP_IDENTITY.name}</p>`);
  });

  it('has no facts table, button or greeting', () => {
    expect(rendered.html).not.toContain('<table');
    expect(rendered.html).not.toContain('<a ');
    expect(renderEmail({ ...minimal, facts: [], action: null }).html).toBe(rendered.html);
  });

  it.each(['', '   '])('leaves a blank greeting (%j) out of both parts', (greeting) => {
    const blank = renderEmail({ ...minimal, greeting });

    expect(blank.html).toBe(rendered.html);
    expect(blank.text).toBe(rendered.text);
  });

  it('puts the intro into the hidden preheader, cut to 110 characters', () => {
    const long = renderEmail({ ...minimal, intro: `${'a'.repeat(110)}TAIL` });

    expect(long.html).toContain(`${'a'.repeat(110)}&zwnj;&nbsp;`);
    expect(long.html).toContain('display: none');
    expect(long.html).toContain(`${'a'.repeat(110)}TAIL</p>`);
    expect(long.html.split('TAIL').length).toBe(2);
  });
});

describe('renderEmail with every part', () => {
  const full: EmailContent = {
    ...minimal,
    title: 'Appointment confirmed',
    subject: 'Appointment confirmed: Tue, 5 Jan',
    greeting: 'Hello Anna,',
    facts: [
      { label: 'When', value: 'Tue, 5 Jan' },
      { label: 'Reference', value: 'AB-12', style: 'code' },
    ],
    action: { label: 'View', url: 'https://example.org/a', note: 'Valid for 1 hour.' },
  };
  const rendered = renderEmail(full);

  it('uses an explicit subject for the inbox and the title for the heading', () => {
    expect(rendered.subject).toBe('Appointment confirmed: Tue, 5 Jan');
    expect(rendered.html).toContain('<title>Appointment confirmed: Tue, 5 Jan</title>');
    expect(rendered.html).toContain('>Appointment confirmed</h1>');
  });

  it('writes every part into the plain text, in order', () => {
    expect(rendered.text).toBe(
      [
        'Hello Anna,',
        'Thanks for joining.',
        'When: Tue, 5 Jan\nReference: AB-12',
        'View: https://example.org/a\nValid for 1 hour.',
        'Ignore this if it was not you.',
      ].join('\n\n'),
    );
  });

  it('renders greeting, facts table, button, note and the printed link', () => {
    expect(rendered.html).toContain('>Hello Anna,</p>');
    expect(rendered.html).toContain('<th scope="row"');
    expect(rendered.html).toContain('>AB-12</td>');
    expect(rendered.html).toContain('href="https://example.org/a"');
    expect(rendered.html).toContain('>View</a>');
    expect(rendered.html).toContain('>Valid for 1 hour.</p>');
    expect(rendered.html).toContain('>https://example.org/a</a>');
  });

  it('leaves the note out of text and html when the action has none', () => {
    const plain = renderEmail({ ...full, action: { label: 'View', url: 'https://example.org/a' } });

    expect(plain.text).toContain('View: https://example.org/a\n\nIgnore');
    expect(plain.html).not.toContain('Valid for 1 hour.');
  });
});

describe('renderEmail escaping', () => {
  const hostile = (name: string) => `<b id="${name}">'&`;
  const rendered = renderEmail({
    locale: hostile('locale'),
    title: hostile('title'),
    subject: hostile('subject'),
    greeting: hostile('greeting'),
    intro: hostile('intro'),
    facts: [{ label: hostile('label'), value: hostile('value'), style: 'code' }],
    action: {
      label: hostile('action'),
      url: 'https://example.org/p?a=1&b="2"<x>',
      note: hostile('note'),
    },
    outro: hostile('outro'),
  });

  it.each([
    'locale',
    'title',
    'subject',
    'greeting',
    'intro',
    'label',
    'value',
    'action',
    'note',
    'outro',
  ])('escapes the %s', (name) => {
    expect(rendered.html).toContain(`&lt;b id=&quot;${name}&quot;&gt;&#39;&amp;`);
  });

  it('lets no injected element through', () => {
    expect(rendered.html).not.toContain('<b ');
    expect(rendered.html).not.toContain('<x>');
    expect(rendered.html).not.toContain('"2"');
  });

  it('escapes the action URL in the button, the fallback link and its printed text', () => {
    const escaped = 'https://example.org/p?a=1&amp;b=&quot;2&quot;&lt;x&gt;';

    expect(rendered.html.split(escaped)).toHaveLength(4);
  });

  it('keeps the plain text unescaped', () => {
    expect(rendered.text).toContain(`${hostile('greeting')}\n\n${hostile('intro')}`);
    expect(rendered.text).toContain(`${hostile('label')}: ${hostile('value')}`);
    expect(rendered.text).not.toContain('&lt;');
  });
});

describe('renderEmail action URLs', () => {
  const withUrl = (url: string) => () =>
    renderEmail({ ...minimal, action: { label: 'Open', url } });

  it.each(['http://example.org/x', 'https://example.org/x'])('accepts %s', (url) => {
    expect(withUrl(url)).not.toThrow();
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.org/x',
    '//example.org/x',
    '/relative',
    'not a url',
    '',
  ])('refuses %j without printing it', (url) => {
    expect(withUrl(url)).toThrow('An e-mail action links to an http(s) address.');
    expect(withUrl(url)).not.toThrow(/alert/);
  });
});
