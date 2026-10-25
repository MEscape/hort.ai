import { CURRICULUM_TEXT_LIMITS } from '../models/curriculum-scope';

/**
 * Control characters other than tab and line break, and the invisible zero-width and direction
 * marks: they can hide text from a reader or reorder it. They become a space.
 */
const INVISIBLE_CHARACTERS =
  // eslint-disable-next-line no-control-regex -- removing control characters is the point
  /[\u0000-\u0008\u000B\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/gu;

/**
 * A word broken over two lines ("eige-" + "nen"): joined back without the hyphen. Only across a
 * line break, so "Mess- und Zeichengeräte" on one line stays as it is.
 */
const BROKEN_WORD = /(\p{L})-[ \t]*\n\s*(\p{Ll})/gu;

export interface BoundedText {
  readonly text: string;
  readonly truncated: boolean;
}

/** Normalizes untrusted text to one clean line: NFC, no invisible characters, single spaces. */
export function toCleanLine(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(INVISIBLE_CHARACTERS, ' ')
    .replace(BROKEN_WORD, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cuts text to `max` characters at a word boundary and marks the cut with an ellipsis. */
export function boundText(text: string, max: number): BoundedText {
  const characters = Array.from(text);
  if (characters.length <= max) {
    return { text, truncated: false };
  }
  const head = characters.slice(0, max - 1).join('');
  const lastSpace = head.lastIndexOf(' ');
  const cut = lastSpace > max / 2 ? head.slice(0, lastSpace) : head;
  return { text: `${cut.trimEnd()}…`, truncated: true };
}

/**
 * One competency statement from untrusted text: cleaned and bounded (#28). Whatever the source
 * says, the result is a single short line of plain text that is passed to the AI as data only.
 */
export function toStatementText(raw: string): BoundedText {
  return boundText(toCleanLine(raw), CURRICULUM_TEXT_LIMITS.statementMax);
}
