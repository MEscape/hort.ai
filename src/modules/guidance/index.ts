/**
 * Server-side public API of the guidance module: Hort.ai's thinking prompts and hints. It holds the AI
 * output contract (domain/ai-output, docs/architecture/ai-output-contract.md), whose stable rejection
 * codes are public so a screen or log reader can map them, and the hint orchestration that only lets a
 * validated AI answer reach the child; `checkChildFacingText` applies the same content and safety rules to
 * text that reaches the child another way (spoken by a tutor). Use cases follow with the hint ladder (#30).
 */

export { createHintOrchestrator } from './composition';
export { checkChildFacingText } from './application/contracts/child-facing-text-constraints';
export type { ChildFacingTextCode } from './application/contracts/child-facing-text-constraints';

export type { HintFallbackReason, HintOutcome } from './application/contracts/hint-views';
export {
  AI_OUTPUT_ERROR_CODES,
  AI_OUTPUT_VALIDATION_CODES,
} from './domain/errors/ai-output-errors';
export type { AiOutputErrorCode, AiOutputValidationCode } from './domain/errors/ai-output-errors';
export {
  CHILD_INPUT_ERROR_CODES,
  CHILD_INPUT_VALIDATION_CODES,
} from './domain/errors/child-input-errors';
export type { ChildInputValidationCode } from './domain/errors/child-input-errors';
export { CHILD_SAFETY_VALIDATION_CODES } from './domain/errors/child-safety-errors';
export type { ChildSafetyValidationCode } from './domain/errors/child-safety-errors';
