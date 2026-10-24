import { err, ok } from '@lib/result';
import { isBlank } from '@lib/utils';

import type { HintOutputValidator } from '../../domain/ports/hint-output-validator.port';

/** Longer than any hint the child should read in one go; the contract (#6) sets the real limit. */
const MAX_INTERIM_HINT_LENGTH = 500;

const REJECTION = { code: 'guidance.interim.output_invalid' } as const;

/**
 * TODO(#6): temporary and deliberately permissive. Replace with the validator
 * of the AI output contract once #6 is merged, and delete this file. It only
 * accepts a non-blank string of bounded length; it does not check the output
 * kind, markup, links or solution leaks (#6, #31, #11).
 */
export const interimHintOutputValidator: HintOutputValidator = {
  validate(raw, { level }) {
    if (typeof raw !== 'string' || isBlank(raw) || raw.length > MAX_INTERIM_HINT_LENGTH) {
      return err(REJECTION);
    }
    return ok({ level, text: raw.trim() });
  },
};
