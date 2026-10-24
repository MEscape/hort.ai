/**
 * Server-side public API of the guidance module: Hort.ai's thinking prompts and hints. So far the
 * module holds the AI output contract (domain/ai-output, docs/architecture/ai-output-contract.md);
 * its stable rejection codes are public so a screen or log reader can map them.
 */

export {
  AI_OUTPUT_ERROR_CODES,
  AI_OUTPUT_VALIDATION_CODES,
} from './domain/errors/ai-output-errors';
export type { AiOutputErrorCode, AiOutputValidationCode } from './domain/errors/ai-output-errors';
