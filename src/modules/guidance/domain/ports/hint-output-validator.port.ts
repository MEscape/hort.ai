import type { Result } from '@lib/result';

import type { HintLevel } from '../models/hint-level';
import type { ValidatedHint } from '../models/validated-hint';

/** Why an AI answer was not accepted, as a stable code (owned by the output contract, #6). */
export interface HintRejection {
  readonly code: string;
}

/** What the validator checks the answer against. */
export interface HintValidationContext {
  readonly level: HintLevel;
}

/**
 * The seam between the untrusted AI answer and anything shown to the child.
 * The output contract (#6) and the solution-leak guard (#31) plug in here.
 */
export interface HintOutputValidator {
  validate(raw: unknown, context: HintValidationContext): Result<ValidatedHint, HintRejection>;
}
