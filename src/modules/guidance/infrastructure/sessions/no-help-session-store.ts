import { notFoundError } from '@lib/errors';
import { errAsync } from '@lib/result';

import { GUIDANCE_ERROR_CODES } from '../../domain/errors/guidance-errors';

import type { HintSessionStore } from '../../domain/ports/hint-session-store.port';

const noSession = () =>
  errAsync(notFoundError(GUIDANCE_ERROR_CODES.sessionNotFound, 'The help session was not found.'));

/**
 * Stands in until help sessions are stored (#17): no session can be started yet, so every session
 * is "not found" and nothing reaches the AI.
 *
 * TODO(#17): replace with the Prisma help-session repository once it lands.
 */
export const noHelpSessionStore: HintSessionStore = {
  load: noSession,
  recordHint: noSession,
  recordAnswerCheck: noSession,
};
