import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import type { Brand } from '@lib/utils';

import { childInputInvalid, CHILD_INPUT_VALIDATION_CODES } from '../errors/child-input-errors';

/** Long enough for a worksheet task typed or transcribed in full, short enough to bound the prompt. */
export const CHILD_TASK_TEXT_MAX_LENGTH = 1000;

/**
 * Control characters other than tab and line break, and the invisible zero-width and direction marks:
 * a child never types them, and they can hide text from a reader or reorder it.
 */
const FORBIDDEN_CHARACTER =
  // eslint-disable-next-line no-control-regex -- matching control characters is the point of this check
  /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/u;

/** The child's task, checked and normalized. Only `parseChildTaskText` creates one. */
export type ChildTaskText = Brand<string, 'ChildTaskText'>;

/**
 * Checks the task a child typed or dictated before it goes anywhere near the AI (#11). Normalizes
 * Unicode and line breaks and trims; rejects empty text, text over the maximum length (counted in
 * characters, so an emoji is one) and invisible or control characters. It does not judge the
 * content: "just tell me the answer" is a valid task text and is handled by the prompt, which passes
 * the task only as data.
 */
export function parseChildTaskText(
  raw: string,
  field = 'task',
): AppResult<ChildTaskText, ValidationAppError> {
  const text = raw.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (text.length === 0) {
    return err(childInputInvalid(field, CHILD_INPUT_VALIDATION_CODES.empty));
  }
  if (Array.from(text).length > CHILD_TASK_TEXT_MAX_LENGTH) {
    return err(childInputInvalid(field, CHILD_INPUT_VALIDATION_CODES.tooLong));
  }
  if (FORBIDDEN_CHARACTER.test(text)) {
    return err(childInputInvalid(field, CHILD_INPUT_VALIDATION_CODES.containsControlCharacter));
  }
  // The checks above are what makes this a ChildTaskText; this is the one place the brand is applied.
  return ok(text as ChildTaskText);
}
