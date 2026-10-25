import { APP_IDENTITY, publicEnv } from '@lib/config';
import { escapeHtml } from '@lib/utils';

import { LOGO_HEIGHT, LOGO_WIDTH } from './email-styles';

import type { emailStyles } from './email-styles';

/** The HTML of the parts of a message. Each takes the styles of the brand it is drawn for. */
type Styles = ReturnType<typeof emailStyles>;

export interface EmailFact {
  readonly label: string;
  readonly value: string;
  /** `code` sets the value in a fixed-width face: a reference a person may read out or copy. */
  readonly style?: 'code';
}

export interface EmailAction {
  readonly label: string;
  /** An `http:` or `https:` address; the layout refuses anything else. */
  readonly url: string;
  /** A quiet line under the button, such as how long the link lasts. */
  readonly note?: string;
}

/** Text by language. English is the platform's default locale and the one every language falls back to. */
type Localized = { readonly en: string } & Readonly<Record<string, string>>;

/** The text for `locale`; a language without one gets English. Own keys only: "constructor" is no language. */
function localized(copy: Localized, locale: string): string {
  return (Object.hasOwn(copy, locale) ? copy[locale] : undefined) ?? copy.en;
}

const PREHEADER_LENGTH = 110;
/** Pushes the body's own text out of the preview line that follows the hidden one. */
const PREHEADER_FILL_REPEATS = 40;
const PREHEADER_FILL = '&zwnj;&nbsp;'.repeat(PREHEADER_FILL_REPEATS);

export function renderPreheader(text: string, styles: Styles): string {
  return `<div style="${styles.preheader}">${escapeHtml(text.slice(0, PREHEADER_LENGTH))}${PREHEADER_FILL}</div>`;
}

/**
 * The product logo as a PNG on the app's own address: mail clients block SVG and inline images are
 * often stripped, a hosted image is what they show. Twice the drawn size, for sharp screens. Its
 * `width` and `height` are the image's own attributes (they reserve the space before it loads), not
 * layout.
 */
const LOGO_PATH = APP_IDENTITY.assets.emailLogo;

export function renderLogo(styles: Styles): string {
  const src = escapeHtml(`${publicEnv.NEXT_PUBLIC_APP_URL}${LOGO_PATH}`);
  return `<img src="${src}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="${escapeHtml(APP_IDENTITY.name)}" style="${styles.logo}">`;
}

/** Said above the printed link, for a client that blocks buttons. */
const LINK_HINT: Localized = {
  de: 'Funktioniert die Schaltfläche nicht? Öffne diesen Link:',
  en: 'Button not working? Open this link:',
};

/**
 * The details as label and value side by side, in a tinted box with rules between the rows. A real
 * table, because this is tabular data: each label is the header of its row.
 */
export function renderFacts(facts: readonly EmailFact[], styles: Styles): string {
  const rows = facts
    .map(({ label, value, style }, index) => {
      const isFirst = index === 0;
      return `<tr><th scope="row" style="${styles.factCell('label', isFirst, false)}">${escapeHtml(label)}</th><td style="${styles.factCell('value', isFirst, style === 'code')}">${escapeHtml(value)}</td></tr>`;
    })
    .join('');
  return `<table style="${styles.facts}"><tbody>${rows}</tbody></table>`;
}

/** A button, a note, and the link in words. */
export function renderAction(action: EmailAction, styles: Styles, locale: string): string {
  const url = escapeHtml(action.url);
  const note =
    action.note === undefined ? '' : `<p style="${styles.note}">${escapeHtml(action.note)}</p>`;
  const button = `<p style="${styles.actionRow}"><a href="${url}" style="${styles.button}">${escapeHtml(action.label)}</a></p>`;
  const fallback = `<p style="${styles.fallback}">${escapeHtml(localized(LINK_HINT, locale))}<br><a href="${url}" style="${styles.fallbackLink}">${url}</a></p>`;
  return `${button}${note}${fallback}`;
}
