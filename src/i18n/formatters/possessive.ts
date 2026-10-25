import type { Locale } from '../config';

/** German writes an apostrophe, not an "s", after a name that already ends in a sibilant. */
const GERMAN_SIBILANT_ENDING = /[sßxz]$/i;

/**
 * A name in the possessive for a heading such as "Mias Welt" or "Max' Welt" (German) and "Mia's
 * World" (English). Surrounding whitespace is ignored.
 */
export function possessive(name: string, locale: Locale): string {
  const trimmed = name.trim();
  if (locale === 'de') {
    return GERMAN_SIBILANT_ENDING.test(trimmed) ? `${trimmed}'` : `${trimmed}s`;
  }
  return `${trimmed}'s`;
}
