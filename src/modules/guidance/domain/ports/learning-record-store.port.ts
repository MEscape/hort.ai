import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ClassSessionRecord } from '../insights/class-overview';
import type { SessionLearningRecord } from '../insights/learning-summary';
import type { ChildProfileId } from '../models/ids';
import type { HelpSessionOwner } from './help-session.repository';

/**
 * Read-only learning data of help sessions for the summaries (#35): ids, statuses, hint rungs and
 * whether the comprehension question was answered. It never reads a task, answer, reply or AI text.
 */
export interface LearningRecordStore {
  /** The parent's own child's sessions started since `since`, newest first, at most `limit`. */
  listChildSessions(
    owner: HelpSessionOwner,
    childProfileId: ChildProfileId,
    since: Date,
    limit: number,
  ): AppResultAsync<readonly SessionLearningRecord[], InfrastructureAppError>;

  /**
   * Every child's sessions on these assignments, for class numbers. The caller passes only the ids
   * of the signed-in teacher's own class, read through the assignments module.
   */
  listAssignmentSessions(
    assignmentIds: readonly string[],
  ): AppResultAsync<readonly ClassSessionRecord[], InfrastructureAppError>;
}
