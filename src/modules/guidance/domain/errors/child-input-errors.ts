import { validationError } from '@lib/errors';
import type { ValidationAppError } from '@lib/errors';

/** Stable codes for child input the backend refuses (#11). Presentation maps them to friendly text. */
export const CHILD_INPUT_ERROR_CODES = {
  invalid: 'guidance.child_input_invalid',
} as const;

/** Why the child's input was refused, carried in `fieldErrors` under the field. */
export const CHILD_INPUT_VALIDATION_CODES = {
  empty: 'guidance.child_input.empty',
  tooLong: 'guidance.child_input.too_long',
  containsControlCharacter: 'guidance.child_input.contains_control_character',
} as const;

export type ChildInputValidationCode =
  (typeof CHILD_INPUT_VALIDATION_CODES)[keyof typeof CHILD_INPUT_VALIDATION_CODES];

/** The refusal of one input field; the field name is the caller's, the input value is never included. */
export function childInputInvalid(
  field: string,
  code: ChildInputValidationCode,
): ValidationAppError {
  return validationError(CHILD_INPUT_ERROR_CODES.invalid, 'The child input is invalid.', {
    [field]: [code],
  });
}
