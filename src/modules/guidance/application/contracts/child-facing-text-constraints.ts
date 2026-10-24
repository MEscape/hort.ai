import { checkAiTextContent } from '../../domain/ai-output/ai-text-rules';
import { checkChildSafeText } from '../../domain/child-safety/check-child-safe-text';
import { AI_OUTPUT_VALIDATION_CODES } from '../../domain/errors/ai-output-errors';

import type { AiOutputValidationCode } from '../../domain/errors/ai-output-errors';
import type { ChildSafetyValidationCode } from '../../domain/errors/child-safety-errors';

export type ChildFacingTextCode = AiOutputValidationCode | ChildSafetyValidationCode;

/**
 * The checks every AI answer passes before a child sees it, for text that reaches the child some
 * other way (read aloud by a tutor): the content rules of the output contract (no control
 * characters, links, markup or code) and the child-safety rules (#11). Returns every violation;
 * none means the text may be shown or spoken. Pure; length limits stay with the caller.
 */
export function checkChildFacingText(text: string): ChildFacingTextCode[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return [AI_OUTPUT_VALIDATION_CODES.textEmpty];
  }
  return [...checkAiTextContent(trimmed), ...checkChildSafeText(trimmed)];
}
