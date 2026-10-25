/**
 * Why AI text was not shown to the child although it met the output contract (#11). Logged as codes,
 * never with the text; the child sees the predefined prompt instead.
 */
export const CHILD_SAFETY_VALIDATION_CODES = {
  asksForPersonalData: 'guidance.child_safety.asks_for_personal_data',
  asksForSecrecy: 'guidance.child_safety.asks_for_secrecy',
  inappropriateContent: 'guidance.child_safety.inappropriate_content',
  discouraging: 'guidance.child_safety.discouraging',
} as const;

export type ChildSafetyValidationCode =
  (typeof CHILD_SAFETY_VALIDATION_CODES)[keyof typeof CHILD_SAFETY_VALIDATION_CODES];

/** The safety classifier could not rate the text, so it is not shown (fail closed). */
export const SAFETY_CLASSIFIER_UNAVAILABLE = 'guidance.child_safety.classifier_unavailable';
