import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import type { Brand } from '@lib/utils';

import { childInputInvalid, CHILD_INPUT_VALIDATION_CODES } from '../errors/child-input-errors';

/** Long enough for a worksheet task typed or transcribed in full, short enough to bound the prompt. */
export const CHILD_TASK_TEXT_MAX_LENGTH = 1000;

/** A teacher's assignment text (#33) may be longer: the assignments module's own bound, and the column's. */
export const ASSIGNMENT_TASK_TEXT_MAX_LENGTH = 4000;

/**
 * Control characters other than tab and line break, and the invisible zero-width and direction marks:
 * a child never types them, and they can hide text from a reader or reorder it.
 */
const FORBIDDEN_CHARACTER =
  // eslint-disable-next-line no-control-regex -- matching control characters is the point of this check
  /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/u;

/** The task of a session, checked and normalized. Only the parsers below create one. */
export type ChildTaskText = Brand<string, 'ChildTaskText'>;

function parseTaskText(
  raw: string,
  field: string,
  maxLength: number,
): AppResult<ChildTaskText, ValidationAppError> {
  const text = raw.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (text.length === 0) {
    return err(childInputInvalid(field, CHILD_INPUT_VALIDATION_CODES.empty));
  }
  if (Array.from(text).length > maxLength) {
    return err(childInputInvalid(field, CHILD_INPUT_VALIDATION_CODES.tooLong));
  }
  if (FORBIDDEN_CHARACTER.test(text)) {
    return err(childInputInvalid(field, CHILD_INPUT_VALIDATION_CODES.containsControlCharacter));
  }
  // The checks above are what makes this a ChildTaskText; this is the one place the brand is applied.
  return ok(text as ChildTaskText);
}

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
  return parseTaskText(raw, field, CHILD_TASK_TEXT_MAX_LENGTH);
}

/**
 * The same checks for a teacher's assignment text (#33), with the assignment's longer bound. Also
 * how a stored session's task is read back, since it holds either kind.
 */
export function parseAssignmentTaskText(raw: string): AppResult<ChildTaskText, ValidationAppError> {
  return parseTaskText(raw, 'task', ASSIGNMENT_TASK_TEXT_MAX_LENGTH);
}
