import type { ChildProfileId, HelpSessionId } from '../models/ids';

/**
 * Rewards an understood task once (#83): the progression module grants `help_session_completed`
 * XP keyed on the session id, so a repeat grants nothing. A failure must not undo the child's
 * success, so `award` never fails; the adapter logs what went wrong.
 */
export interface SessionReward {
  award(childProfileId: ChildProfileId, sessionId: HelpSessionId): Promise<void>;
}
