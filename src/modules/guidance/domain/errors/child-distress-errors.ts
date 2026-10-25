import { validationError } from '@lib/errors';
import type { ValidationAppError } from '@lib/errors';

/**
 * A child's message clearly signals distress (#90). It is not a task: the help screen shows the
 * fixed companion text with the Nummer gegen Kummer (116 111) instead of a hint, and no AI is asked.
 * The same code is the one that is logged, without the text.
 */
export const CHILD_DISTRESS_ERROR_CODES = {
  distressSignal: 'guidance.child_safety.distress_signal',
} as const;

/** The refusal of one input field; the field name is the caller's, the input value is never included. */
export function childInDistress(field: string): ValidationAppError {
  return validationError(
    CHILD_DISTRESS_ERROR_CODES.distressSignal,
    'The child needs help, not a hint.',
    { [field]: [CHILD_DISTRESS_ERROR_CODES.distressSignal] },
  );
}
