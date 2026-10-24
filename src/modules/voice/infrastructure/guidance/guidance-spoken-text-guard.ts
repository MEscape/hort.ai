import { checkChildFacingText } from '@modules/guidance';

import type { SpokenTextGuard } from '../../domain/ports/spoken-text-guard.port';

/**
 * The guidance module's checks for text a child sees or hears (output-contract content rules and
 * the child-safety rules), so speech and screen follow one rule set.
 */
export const guidanceSpokenTextGuard: SpokenTextGuard = {
  isSafe: (text) => checkChildFacingText(text).length === 0,
};
