/**
 * Server-side public API of the guidance module: Hort.ai's thinking prompts and hints. It holds the AI
 * output contract (domain/ai-output, docs/architecture/ai-output-contract.md), whose stable rejection
 * codes are public so a screen or log reader can map them, and the hint orchestration that only lets a
 * validated AI answer reach the child, and the server-side help sessions (#17, #78) a child can continue.
 */

export {
  createHintOrchestrator,
  getGuidanceCommands,
  getHelpSessionCommands,
  getHelpSessionQueries,
} from './composition';
export type { CheckAnswerError } from './application/commands/check-answer';
export type { RequestHintError } from './application/commands/request-hint';
export type { CheckAnswerInput, RequestHintInput } from './application/contracts/hint-inputs';
export type { StartHelpSessionError } from './application/commands/start-help-session';
export type { ReplyToComprehensionQuestionError } from './application/commands/reply-to-comprehension-question';
export type { GetOpenHelpSessionError } from './application/queries/get-open-help-session';
export type {
  GetOpenHelpSessionInput,
  ReplyToComprehensionQuestionInput,
  StartHelpSessionInput,
} from './application/contracts/help-session-inputs';
export type {
  AnswerCheckView,
  ComprehensionReplyView,
  HelpSessionView,
  StartHelpSessionView,
} from './application/contracts/help-session-views';

export type { AnswerFeedback, FeedbackText } from './application/contracts/answer-views';

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
