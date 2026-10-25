import { createPersistenceFailures, dateToInstant, db } from '@lib/db';
import { fromThrowableAsync, okAsync } from '@lib/result';
import { groupBy } from '@lib/utils';

import { GUIDANCE_ERROR_CODES } from '../../domain/errors/guidance-errors';

import { toSessionLearningRecord, toSessionStatus } from './learning-record-record-mapper';

import type { ChildSessionRow } from './learning-record-record-mapper';
import type { ClassSessionRecord } from '../../domain/insights/class-overview';
import type { SessionLearningRecord } from '../../domain/insights/learning-summary';
import type { LearningRecordRepository } from '../../domain/ports/learning-record.repository';

const failures = createPersistenceFailures({
  module: 'guidance.persistence',
  code: GUIDANCE_ERROR_CODES.sessionStoreFailed,
  subject: 'HelpSession',
});

/**
 * The summaries' reads (#35). Only ids, statuses, timestamps and hint rungs are selected: the task
 * text, the child's answers and replies and every AI text stay out of these queries.
 */
export class PrismaLearningRecordRepository implements LearningRecordRepository {
  listChildSessions: LearningRecordRepository['listChildSessions'] = (
    owner,
    childProfileId,
    since,
    bounds,
  ) =>
    fromThrowableAsync(async () => {
      const sessions = await db.orm.public.HelpSession.select(
        'id',
        'assignmentId',
        'competencyCode',
        'openTopicLabel',
        'status',
        'startedAt',
      )
        .where({ tenantId: owner.tenantId, ownerId: owner.ownerId, childProfileId })
        .where((row) => row.startedAt.gte(dateToInstant(since)))
        .orderBy([(row) => row.startedAt.desc(), (row) => row.id.desc()])
        .limit(bounds.sessions)
        .all();
      if (sessions.length === 0) {
        return [];
      }
      const ids = sessions.map(({ id }) => id);
      const [hints, questions] = await Promise.all([
        // @owner-scope derived The session ids come from the read above, pinned to tenant, owner and child.
        db.orm.public.HintEvent.where((row) => row.sessionId.in(ids))
          .select('sessionId', 'level')
          .limit(bounds.steps)
          .all(),
        // @owner-scope derived The session ids come from the read above, pinned to tenant, owner and child.
        db.orm.public.ComprehensionQuestion.where((row) => row.sessionId.in(ids))
          .where((row) => row.repliedAt.isNotNull())
          .select('sessionId')
          .limit(bounds.steps)
          .all(),
      ]);
      const hintsBySession = groupBy(hints, ({ sessionId }) => sessionId);
      const answered = new Set(questions.map(({ sessionId }) => sessionId));
      return sessions.flatMap((session: ChildSessionRow): SessionLearningRecord[] => {
        const record = toSessionLearningRecord(
          session,
          hintsBySession.get(session.id) ?? [],
          answered.has(session.id),
        );
        return record === null ? [] : [record];
      });
    }, failures.infraOnly('listChildSessions'));

  listAssignmentSessions: LearningRecordRepository['listAssignmentSessions'] = (
    assignmentIds,
    bounds,
  ) => {
    if (assignmentIds.length === 0) {
      return okAsync([]);
    }
    const ids = [...assignmentIds];
    return fromThrowableAsync(async () => {
      // @owner-scope derived Across parents on purpose: the assignment ids are the teacher's own class's, read through the assignments module; only class numbers leave the use case.
      const sessions = await db.orm.public.HelpSession.where((row) => row.assignmentId.in(ids))
        .select('id', 'assignmentId', 'childProfileId', 'status')
        .limit(bounds.sessions)
        .all();
      if (sessions.length === 0) {
        return [];
      }
      const sessionIds = sessions.map(({ id }) => id);
      // @owner-scope derived The session ids come from the read above.
      const hints = await db.orm.public.HintEvent.where((row) => row.sessionId.in(sessionIds))
        .groupBy('sessionId')
        .orderBy((row) => row.sessionId.asc())
        .limit(bounds.sessions)
        .aggregate((aggregate) => ({ count: aggregate.count() }));
      const hintCounts = new Map(hints.map(({ sessionId, count }) => [sessionId, count]));
      return sessions.flatMap((session): ClassSessionRecord[] => {
        const status = toSessionStatus(session.status);
        return status === undefined || session.assignmentId === null
          ? []
          : [
              {
                assignmentId: session.assignmentId,
                childProfileId: session.childProfileId,
                status,
                hintCount: hintCounts.get(session.id) ?? 0,
              },
            ];
      });
    }, failures.infraOnly('listAssignmentSessions'));
  };
}
