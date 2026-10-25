/**
 * Server-side public API of the guidance module: Hort.ai's thinking prompts and hints. It holds the AI
 * output contract (domain/ai-output, docs/architecture/ai-output-contract.md), whose stable rejection
 * codes are public so a screen or log reader can map them, and the hint orchestration that only lets a
 * validated AI answer reach the child. Use cases follow with the hint ladder (#30).
 */

export { createGuidanceCommands, createHintOrchestrator } from './composition';
export type { RequestHintError } from './application/commands/request-hint';
export type { RequestHintInput } from './application/contracts/hint-inputs';

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
export { GUIDANCE_ERROR_CODES, GUIDANCE_VALIDATION_CODES } from './domain/errors/guidance-errors';
