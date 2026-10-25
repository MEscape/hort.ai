/**
 * Server-side public API of the guidance module: Hort.ai's thinking prompts and hints. It holds the AI
 * output contract (domain/ai-output, docs/architecture/ai-output-contract.md), whose stable rejection
 * codes are public so a screen or log reader can map them, and the hint orchestration that only lets a
 * validated AI answer reach the child, the hint ladder (#30), which decides each hint's level from
 * the stored help session, and the server-side help sessions (#17, #78) a child can continue.
 */

export {
  createHintOrchestrator,
  getGuidanceCommands,
  getHelpSessionCommands,
  getHelpSessionQueries,
} from './composition';
export type { CheckAnswerError } from './application/commands/check-answer';
export type { RequestHintError } from './application/commands/request-hint';
export type {
  CheckAnswerInput,
  HelpSessionStepInput,
  RequestHintInput,
} from './application/contracts/hint-inputs';
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

export type { HintFallbackReason, HintOutcome, HintStep } from './application/contracts/hint-views';
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

/** The module's message catalogs, registered in `src/i18n/locales`. */
/** Framework entry point for pages: the child's open help session, or `null` (#17). */
export { loadOpenHelpSession } from './presentation/guards/load-open-help-session';
export type { HelpSessionDto } from './presentation/dto/help-session-dto';

export { default as enGuidance } from './presentation/i18n/en.json';
export { default as deGuidance } from './presentation/i18n/de.json';
