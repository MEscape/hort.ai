import { getProgressionCommands } from '@modules/progression';

import { logger } from '@lib/logger';

import type { SessionReward } from '../../domain/ports/session-reward.port';

/**
 * Asks the progression module for the `help_session_completed` XP, keyed on the session id, so the
 * same session rewards once however often this runs. The child's success stands even when the
 * reward fails: the failure is logged with its code only.
 */
export const progressionSessionReward: SessionReward = {
  async award(childProfileId, sessionId) {
    const result = await getProgressionCommands().awardLearningXp.execute({
      childProfileId,
      event: 'help_session_completed',
      eventKey: sessionId,
    });
    if (result.isErr()) {
      logger.warn('Session XP not granted.', {
        module: 'guidance.reward',
        code: result.error.code,
      });
    }
  },
};
