import { err, ok } from '@lib/result';
import type { ValidationAppError } from '@lib/errors';
import type { AppResult } from '@lib/result';

import { detectDistressSignal } from '../../domain/child-safety/detect-distress-signal';
import { childInDistress } from '../../domain/errors/child-distress-errors';

import type { ChildTaskText } from '../../domain/models/child-task-text';
import type { GuidanceAuditLog } from '../../domain/ports/guidance-audit-log.port';

/** The child inputs that are checked: the task, an answer, a reply to the comprehension question. */
export type ChildInputField = 'task' | 'answer' | 'reply';

/**
 * The first look at every child input, right after it is parsed and before the budget, the session,
 * a classifier or the AI see it (#90). A clear distress signal ends the request with
 * `guidance.child_safety.distress_signal`; the help screen answers with the fixed help text. The
 * audit event is anonymous on purpose: the category and which input, no ids, never the text. Nobody
 * is notified automatically, not even the parent, who may be part of the problem.
 */
export function checkForDistress(
  audit: GuidanceAuditLog,
  text: ChildTaskText,
  field: ChildInputField,
): AppResult<ChildTaskText, ValidationAppError> {
  const category = detectDistressSignal(text);
  if (category === null) {
    return ok(text);
  }
  audit.record({ type: 'guidance.child_safety.distress_signal', category, field });
  return err(childInDistress(field));
}
