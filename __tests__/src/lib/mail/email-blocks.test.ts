import { describe, expect, it } from 'vitest';

import { EMAIL_BRAND } from '@lib/mail';
import { renderAction, renderFacts } from '@lib/mail/email-blocks';
import { emailStyles } from '@lib/mail/email-styles';

const styles = emailStyles(EMAIL_BRAND);
const action = { label: 'Open', url: 'https://example.org/x' };

describe('renderAction link hint', () => {
  it.each([
    ['de', 'Funktioniert die Schaltfläche nicht? Öffne diesen Link:'],
    ['en', 'Button not working? Open this link:'],
  ])('is said in %s', (locale, hint) => {
    expect(renderAction(action, styles, locale)).toContain(hint);
  });

  it.each(['fr', 'constructor', '__proto__', ''])('falls back to English for %j', (locale) => {
    expect(renderAction(action, styles, locale)).toContain('Button not working?');
  });
});

describe('renderFacts', () => {
  it('sets labels as row headers and rules between rows, not above the first', () => {
    const html = renderFacts(
      [
        { label: 'A', value: '1' },
        { label: 'B', value: '2' },
      ],
      styles,
    );
    const [first, second] = html.split('<tr>').slice(1);

    expect(first).not.toContain('border-top');
    expect(second).toContain('border-top');
    expect(html.match(/<th scope="row"/g)).toHaveLength(2);
  });

  it('sets only code values in the fixed-width face', () => {
    const html = renderFacts(
      [
        { label: 'Plain', value: 'p' },
        { label: 'Ref', value: 'r', style: 'code' },
      ],
      styles,
    );
    const [plain, code] = html.split('<tr>').slice(1);

    expect(plain).not.toContain(EMAIL_BRAND.font.mono);
    expect(code).toContain(EMAIL_BRAND.font.mono);
  });
});

describe('EMAIL_BRAND', () => {
  it('uses literal colours only, since mail clients resolve no CSS variables', () => {
    for (const value of Object.values(EMAIL_BRAND.color)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('ends every font stack in a system font', () => {
    expect(EMAIL_BRAND.font.heading).toMatch(/sans-serif$/);
    expect(EMAIL_BRAND.font.body).toMatch(/sans-serif$/);
    expect(EMAIL_BRAND.font.mono).toMatch(/monospace$/);
  });
});
