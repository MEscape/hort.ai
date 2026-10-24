import { AI_OUTPUT_VALIDATION_CODES } from '../errors/ai-output-errors';

import { AI_TEXT_MAX_LENGTH } from './ai-output';

import type { AiOutputKind } from './ai-output';
import type { AiOutputValidationCode } from '../errors/ai-output-errors';

/** Control characters other than a line break: invisible to a reader, useful only for smuggling. */
const CONTROL_CHARACTER =
  // eslint-disable-next-line no-control-regex -- matching control characters is the point of this check
  /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F]/u;

/** A scheme (`https://`, `javascript:`, `mailto:`), `www.` or a bare domain with a common top-level domain. */
const URL_PATTERNS = [
  /\b[a-z][a-z0-9+.-]*:\/\//i,
  /\b(?:javascript|data|mailto|tel|file|vbscript):/i,
  /\bwww\./i,
  /\b[a-z0-9-]+\.(?:com|de|org|net|info|io|ai|app|dev|eu|at|ch|ly|me|co|tv|gg)\b/i,
];

/**
 * HTML tags and entities, and the Markdown a renderer would turn into links, images, emphasis, headings or
 * quotes. `__` stays allowed because worksheets mark a blank with it (`3 + __ = 7`), and `<` before a digit
 * or a space is a comparison, not a tag.
 */
const MARKUP_PATTERNS = [
  /<[a-z!/?]/i,
  /&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i,
  /!?\[[^\]]*\]\([^)]*\)/,
  /\*\*|~~/,
  /^\s{0,3}#{1,6}\s/m,
  /^\s{0,3}>\s/m,
];

/** Code a child never needs in homework help: backticks, braces, arrows, calls of known runtimes. */
const CODE_PATTERNS = [
  /`/,
  /[{}]/,
  /=>/,
  /\b(?:function|return|eval|console|document|window)\s*[.(]/,
];

const QUESTION_MARK = '?';

/**
 * Checks the text of an output against the content rules of its kind. Returns every violation (none
 * when the text is acceptable). The solution-leak check (#31) runs after this one, with the task.
 */
export function checkAiText(text: string, kind: AiOutputKind): AiOutputValidationCode[] {
  if (text.length === 0) {
    return [AI_OUTPUT_VALIDATION_CODES.textEmpty];
  }
  const codes: AiOutputValidationCode[] = [];
  if (Array.from(text).length > AI_TEXT_MAX_LENGTH[kind]) {
    codes.push(AI_OUTPUT_VALIDATION_CODES.textTooLong);
  }
  if (CONTROL_CHARACTER.test(text)) {
    codes.push(AI_OUTPUT_VALIDATION_CODES.containsControlCharacter);
  }
  if (URL_PATTERNS.some((pattern) => pattern.test(text))) {
    codes.push(AI_OUTPUT_VALIDATION_CODES.containsUrl);
  }
  if (MARKUP_PATTERNS.some((pattern) => pattern.test(text))) {
    codes.push(AI_OUTPUT_VALIDATION_CODES.containsMarkup);
  }
  if (CODE_PATTERNS.some((pattern) => pattern.test(text))) {
    codes.push(AI_OUTPUT_VALIDATION_CODES.containsCode);
  }
  if (kind === 'comprehension_question' && !text.endsWith(QUESTION_MARK)) {
    codes.push(AI_OUTPUT_VALIDATION_CODES.notAQuestion);
  }
  return codes;
}
