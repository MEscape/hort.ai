import { validationError } from '@lib/errors';
import type { ValidationAppError } from '@lib/errors';

/**
 * Stable codes for a rejected AI output (docs/architecture/ai-output-contract.md). The caller logs the
 * code and shows a predefined fallback; nothing here is user-facing prose.
 */
export const AI_OUTPUT_ERROR_CODES = {
  rejected: 'guidance.ai_output_rejected',
} as const;

/** Why an AI output was rejected, carried in `fieldErrors` under the offending field (`$` for the whole output). */
export const AI_OUTPUT_VALIDATION_CODES = {
  notAnObject: 'guidance.ai_output.not_an_object',
  unsupportedVersion: 'guidance.ai_output.unsupported_version',
  unknownKind: 'guidance.ai_output.unknown_kind',
  unexpectedKind: 'guidance.ai_output.unexpected_kind',
  unknownField: 'guidance.ai_output.unknown_field',
  missingField: 'guidance.ai_output.missing_field',
  invalidType: 'guidance.ai_output.invalid_type',
  invalidHintLevel: 'guidance.ai_output.invalid_hint_level',
  unexpectedHintLevel: 'guidance.ai_output.unexpected_hint_level',
  invalidCompetencyId: 'guidance.ai_output.invalid_competency_id',
  invalidAssessmentResult: 'guidance.ai_output.invalid_assessment_result',
  textEmpty: 'guidance.ai_output.text_empty',
  textTooLong: 'guidance.ai_output.text_too_long',
  notAQuestion: 'guidance.ai_output.not_a_question',
  containsControlCharacter: 'guidance.ai_output.contains_control_character',
  containsUrl: 'guidance.ai_output.contains_url',
  containsMarkup: 'guidance.ai_output.contains_markup',
  containsCode: 'guidance.ai_output.contains_code',
  /** Set by the solution-leak guard (#31), not by the shape check, which cannot see the task's solution. */
  solutionLeaked: 'guidance.ai_output.solution_leaked',
} as const;

export type AiOutputErrorCode = (typeof AI_OUTPUT_ERROR_CODES)[keyof typeof AI_OUTPUT_ERROR_CODES];
export type AiOutputValidationCode =
  (typeof AI_OUTPUT_VALIDATION_CODES)[keyof typeof AI_OUTPUT_VALIDATION_CODES];

/** The rejection of an AI output: every violation found, keyed by field. */
export function aiOutputRejected(
  fieldErrors: Record<string, AiOutputValidationCode[]>,
): ValidationAppError {
  return validationError(
    AI_OUTPUT_ERROR_CODES.rejected,
    'The AI output violates the output contract.',
    fieldErrors,
  );
}
