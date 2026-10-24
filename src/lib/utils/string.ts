/**
 * String and plain-text helpers. Zero dependencies.
 *
 * Locale-sensitive display formatting lives in `number.ts` and `date.ts` (i18n.md). The HTML
 * helpers work on text that comes from outside (external data sources): `escapeHtml` makes text
 * safe to put INTO markup, `stripHtml` takes text OUT of markup for previews. Neither is a
 * sanitizer for markup that will be rendered as HTML.
 */

import { invariant } from './assert';

const TRANSLITERATIONS: Readonly<Record<string, string>> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  å: 'a',
  ł: 'l',
  đ: 'd',
};

/**
 * Builds a URL-safe slug: lowercase `a-z`, digits and single hyphens. German umlauts and `ß` are
 * transliterated (`Bürgerbüro` becomes `buergerbuero`), other accents are stripped, and anything
 * else becomes a hyphen. Returns an empty string when nothing usable remains, so a caller must
 * handle that.
 *
 * @example slugify('Bürgerbüro & Co.') // 'buergerbuero-co'
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüßæœøåłđ]/g, (char) => {
      const replacement = TRANSLITERATIONS[char];
      invariant(replacement !== undefined, 'Every letter the pattern matches has a replacement.');
      return replacement;
    })
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncates to `maxLength` characters (Unicode code points, so emoji are not split), appending an
 * ellipsis only when truncation actually happened. The ellipsis counts toward `maxLength`, and
 * trailing whitespace before it is dropped. `maxLength` should be a whole number of at least 1;
 * with 1 the result is the ellipsis alone, with 0 or less it is empty.
 *
 * @example truncate('Hello world', 8) // 'Hello w…'
 */
export function truncate(text: string, maxLength: number): string {
  const characters = Array.from(text);
  if (characters.length <= maxLength) {
    return text;
  }
  if (maxLength <= 1) {
    return '…'.slice(0, Math.max(0, maxLength));
  }
  return `${characters
    .slice(0, maxLength - 1)
    .join('')
    .trimEnd()}…`;
}

/**
 * Collapses runs of whitespace (including newlines and non-breaking spaces) into single spaces and
 * trims the ends.
 *
 * @example normalizeWhitespace('  a 
 b  ') // 'a b'
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  quot: '"',
  amp: '&',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  pound: '£',
  yen: '¥',
  sect: '§',
  deg: '°',
  plusmn: '±',
  auml: 'ä',
  Auml: 'Ä',
  ouml: 'ö',
  Ouml: 'Ö',
  uuml: 'ü',
  Uuml: 'Ü',
  szlig: 'ß',
  eacute: 'é',
  Eacute: 'É',
  egrave: 'è',
  Egrave: 'È',
  ecirc: 'ê',
  Ecirc: 'Ê',
  agrave: 'à',
  Agrave: 'À',
  acirc: 'â',
  Acirc: 'Â',
  ccedil: 'ç',
  Ccedil: 'Ç',
};

const MAX_UNICODE_CODE_POINT = 0x10ffff;

/** The character for `digits` in `radix`, or `null` beyond Unicode; the caller's pattern guarantees digits only. */
function parseCodePoint(digits: string, radix: number): string | null {
  const code = Number.parseInt(digits, radix);
  return code <= MAX_UNICODE_CODE_POINT ? String.fromCodePoint(code) : null;
}

/**
 * Decodes named, decimal and hexadecimal HTML entities into their plain characters. Only the
 * entities listed in this file are known by name; an unknown name or a code point beyond U+10FFFF
 * stays as written.
 *
 * @example decodeHtmlEntities('W&uuml;rzburg &#x26; &amp;') // 'Würzburg & &'
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(?:#x([0-9a-fA-F]+)|#([0-9]+)|([a-zA-Z0-9]+));/g,
    // Exactly one of the three groups matched.
    (
      match: string,
      hex: string | undefined,
      dec: string | undefined,
      named: string | undefined,
    ) => {
      if (hex !== undefined) {
        return parseCodePoint(hex, 16) ?? match;
      }
      if (dec !== undefined) {
        return parseCodePoint(dec, 10) ?? match;
      }
      invariant(named !== undefined, 'One of the three groups matched.');
      // Own entries only: `&constructor;` must not find `Object.prototype.constructor`.
      return (Object.hasOwn(HTML_ENTITIES, named) ? HTML_ENTITIES[named] : undefined) ?? match;
    },
  );
}

/** Elements whose content is code, not text, so it goes with the tags. */
const RAW_TEXT_ELEMENTS = [
  { name: 'script', closing: /<\/script>/gi },
  { name: 'style', closing: /<\/style>/gi },
] as const;

/**
 * Removes HTML tags and decodes entities for plain-text previews. This is NOT a sanitizer:
 * never use its output to make untrusted markup safe to render as HTML
 * (security.md: "never render untrusted content as raw HTML; sanitize it
 * first if unavoidable" — this function is a preview helper, not that
 * sanitizer).
 *
 * A tag runs from `<` to the next `>`; a `<` with no `>` after it is text. One pass, linear in the
 * input: the text comes from external data sources, and a pattern that rescans to the end for every
 * `<` (`<[^>]*>`) takes seconds on a 100 KB string of them. Once a closing tag is missing, none
 * follows, so its search is not repeated.
 */
export function stripHtml(html: string): string {
  const unclosed = new Set<RegExp>();
  let text = '';
  let position = 0;

  for (;;) {
    const open = html.indexOf('<', position);
    const close = open === -1 ? -1 : html.indexOf('>', open + 1);
    if (close === -1) {
      text += html.slice(position);
      break;
    }
    text += `${html.slice(position, open)} `;
    position = close + 1;

    const element = RAW_TEXT_ELEMENTS.find(
      ({ name }) => html.slice(open + 1, open + 1 + name.length).toLowerCase() === name,
    );
    if (element !== undefined && !unclosed.has(element.closing)) {
      element.closing.lastIndex = position;
      const end = element.closing.exec(html);
      if (end === null) {
        unclosed.add(element.closing);
      } else {
        position = end.index + end[0].length;
      }
    }
  }

  return normalizeWhitespace(decodeHtmlEntities(text));
}

/**
 * Escapes the characters that are significant in HTML text and in quoted attribute values
 * (`& < > " '`). For text going into markup you build yourself (e-mail); in React, text is escaped
 * for you.
 *
 * @example escapeHtml('<a href="x">') // '&lt;a href=&quot;x&quot;&gt;'
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** True for `null`, `undefined`, the empty string and a string of whitespace only. */
export function isBlank(text: string | null | undefined): boolean {
  return text === null || text === undefined || text.trim().length === 0;
}

/**
 * Trims the text; returns `null` when nothing is left (or the input is absent). For optional text
 * stored as NULL.
 *
 * @example trimToNull('  ') // null
 */
export function trimToNull(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}
