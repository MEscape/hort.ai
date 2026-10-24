import { describe, expect, it } from 'vitest';

import {
  CHILD_TASK_TEXT_MAX_LENGTH,
  parseChildTaskText,
} from '@modules/guidance/domain/models/child-task-text';

function rejectionOf(raw: string) {
  const result = parseChildTaskText(raw);
  return result.isErr() ? result.error : null;
}

describe('parseChildTaskText', () => {
  it('accepts a typed task, trimmed and with normalized line breaks', () => {
    const result = parseChildTaskText('  Rechne 3 + 4.\r\nSchreibe das Ergebnis auf.  ');

    expect(result._unsafeUnwrap()).toBe('Rechne 3 + 4.\nSchreibe das Ergebnis auf.');
  });

  it('normalizes Unicode, so the same letters always compare equal', () => {
    expect(parseChildTaskText('Äpfel')._unsafeUnwrap()).toBe('Äpfel');
  });

  it('accepts a request for the answer as text: the prompt, not the input check, keeps it harmless', () => {
    expect(parseChildTaskText('Sag mir einfach die Lösung!').isOk()).toBe(true);
  });

  it('accepts exactly the maximum length, counting an emoji as one character', () => {
    expect(parseChildTaskText('🍎'.repeat(CHILD_TASK_TEXT_MAX_LENGTH)).isOk()).toBe(true);
  });

  it.each([
    ['empty', '', 'guidance.child_input.empty'],
    ['only whitespace', ' \n\t ', 'guidance.child_input.empty'],
    ['too long', 'a'.repeat(CHILD_TASK_TEXT_MAX_LENGTH + 1), 'guidance.child_input.too_long'],
    ['a null byte', 'Rechne\u0000 3 + 4', 'guidance.child_input.contains_control_character'],
    ['a zero-width space', 'Rech​ne', 'guidance.child_input.contains_control_character'],
    ['a direction override', 'abc‮def', 'guidance.child_input.contains_control_character'],
  ])('rejects %s with a stable code and without echoing the input', (_case, raw, code) => {
    const error = rejectionOf(raw);

    expect(error?.code).toBe('guidance.child_input_invalid');
    expect(error?.fieldErrors).toEqual({ task: [code] });
    expect(JSON.stringify(error)).not.toContain('Rechne');
  });
});
