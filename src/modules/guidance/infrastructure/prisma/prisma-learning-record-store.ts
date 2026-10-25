import { createPersistenceFailures, dateToInstant, db, instantToDate } from '@lib/db';
import { fromThrowableAsync, okAsync } from '@lib/result';
import { groupBy } from '@lib/utils';

import { GUIDANCE_ERROR_CODES } from '../../domain/errors/guidance-errors';

import { LEVEL_RECORD, STATUS_RECORD } from './help-session-record-mapper';

import type { ClassSessionRecord } from '../../domain/insights/class-overview';
import type { SessionLearningRecord } from '../../domain/insights/learning-summary';
import type { HelpSessionStatus } from '../../domain/models/help-session';
import type { HintLevel } from '../../domain/models/hint-level';
import type { LearningRecordStore } from '../../domain/ports/learning-record-store.port';

const failures = createPersistenceFailures({
  module: 'guidance.persistence',
  code: GUIDANCE_ERROR_CODES.sessionStoreFailed,
  subject: 'HelpSession',
});

/** Bounds of the class read (performance.md): far above a class's real sessions on its assignments. */
const CLASS_SESSION_LIMIT = 2000;
const HINT_ROW_LIMIT = 20000;

const STATUS_BY_RECORD = new Map<string, HelpSessionStatus>(
  (Object.keys(STATUS_RECORD) as HelpSessionStatus[]).map((status) => [
    STATUS_RECORD[status],
    status,
  ]),
);
const LEVEL_BY_RECORD = new Map<string, HintLevel>(
  (Object.keys(LEVEL_RECORD) as HintLevel[]).map((level) => [LEVEL_RECORD[level], level]),
);

/**
 * The summaries' reads (#35). Only ids, statuses, timestamps and hint rungs are selected: the task
 * text, the child's answers and replies and every AI text stay out of these queries.
 */
export class PrismaLearningRecordStore implements LearningRecordStore {
  listChildSessions: LearningRecordStore['listChildSessions'] = (
    owner,
    childProfileId,
    since,
    limit,
  ) =>
    fromThrowableAsync(async () => {
      const sessions = await db.orm.public.HelpSession.where({
        tenantId: owner.tenantId,
        ownerId: owner.ownerId,
        childProfileId,
      })
        .where((row) => row.startedAt.gte(dateToInstant(since)))
        .select('id', 'assignmentId', 'competencyCode', 'openTopicLabel', 'status', 'startedAt')
        .orderBy([(row) => row.startedAt.desc(), (row) => row.id.desc()])
        .limit(limit)
        .all();
      if (sessions.length === 0) {
        return [];
      }
      const ids = sessions.map(({ id }) => id);
      const [hints, questions] = await Promise.all([
        // @owner-scope derived The session ids come from the read above, pinned to tenant, owner and child.
        db.orm.public.HintEvent.where((row) => row.sessionId.in(ids))
          .select('sessionId', 'level')
          .limit(HINT_ROW_LIMIT)
          .all(),
        // @owner-scope derived The session ids come from the read above, pinned to tenant, owner and child.
        db.orm.public.ComprehensionQuestion.where((row) => row.sessionId.in(ids))
          .where((row) => row.repliedAt.isNotNull())
          .select('sessionId')
          .limit(HINT_ROW_LIMIT)
          .all(),
      ]);
      const hintsBySession = groupBy(hints, ({ sessionId }) => sessionId);
      const answered = new Set(questions.map(({ sessionId }) => sessionId));
      return sessions.flatMap((session): SessionLearningRecord[] => {
        const status = STATUS_BY_RECORD.get(session.status);
        if (status === undefined) {
          return [];
        }
        return [
          {
            assignmentId: session.assignmentId,
            competencyCode: session.competencyCode,
            openTopicLabel: session.openTopicLabel,
            status,
            startedAt: instantToDate(session.startedAt),
            hintLevels: (hintsBySession.get(session.id) ?? []).flatMap(({ level }) => {
              const known = LEVEL_BY_RECORD.get(level);
              return known === undefined ? [] : [known];
            }),
            comprehensionAnswered: answered.has(session.id),
          },
        ];
      });
    }, failures.infraOnly('listChildSessions'));

  listAssignmentSessions: LearningRecordStore['listAssignmentSessions'] = (assignmentIds) => {
    if (assignmentIds.length === 0) {
      return okAsync([]);
    }
    const ids = [...assignmentIds];
    return fromThrowableAsync(async () => {
      // @owner-scope derived Across parents on purpose: the assignment ids are the teacher's own class's, read through the assignments module; only class numbers leave the use case.
      const sessions = await db.orm.public.HelpSession.where((row) => row.assignmentId.in(ids))
        .select('id', 'assignmentId', 'childProfileId', 'status')
        .limit(CLASS_SESSION_LIMIT)
        .all();
      if (sessions.length === 0) {
        return [];
      }
      const sessionIds = sessions.map(({ id }) => id);
      // @owner-scope derived The session ids come from the read above.
      const hints = await db.orm.public.HintEvent.where((row) => row.sessionId.in(sessionIds))
        .groupBy('sessionId')
        .orderBy((row) => row.sessionId.asc())
        .limit(CLASS_SESSION_LIMIT)
        .aggregate((aggregate) => ({ count: aggregate.count() }));
      const hintCounts = new Map(hints.map(({ sessionId, count }) => [sessionId, count]));
      return sessions.flatMap((session): ClassSessionRecord[] => {
        const status = STATUS_BY_RECORD.get(session.status);
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
