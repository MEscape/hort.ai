import { createPersistenceFailures, dateToInstant, db } from '@lib/db';
import { fromThrowableAsync } from '@lib/result';

import { PARENT_TASK_SELECT, toParentTask } from './parent-learning-record-mapper';

import type { ParentTaskId } from '../../domain/models/ids';
import type { ParentLearningRecords } from '../../domain/models/parent-learning';
import type {
  ParentLearningRepository,
  ParentLearningScope,
} from '../../domain/ports/parent-learning.repository';

const failures = createPersistenceFailures({
  module: 'learner.parent-learning',
  code: 'learner.persistence_failed',
  subject: 'Learning overview',
});

/** Rooted in the stored child owner. Current class membership is rechecked within the same SQL projection. */
const childOf = ({ childProfileId, ownerId, tenantId }: ParentLearningScope) =>
  db.orm.public.ChildProfile.where({ id: childProfileId, ownerId, tenantId });

/** One more than counted, so a longer list is recognised as unavailable; nothing when notes are off. */
const evidenceRows = (scope: ParentLearningScope) =>
  scope.includeInsights ? scope.evidenceLimit + 1 : 0;

/** Narrow read model over the existing schema; it neither creates learning records nor selects conversations. */
export class PrismaParentLearningRepository implements ParentLearningRepository {
  list(scope: ParentLearningScope, period: { readonly from: string; readonly until: string }) {
    const { tenantId, ownerId, childProfileId, recordLimit } = scope;
    const fetchLimit = recordLimit + 1;
    const evidence = evidenceRows(scope);
    return fromThrowableAsync(async (): Promise<ParentLearningRecords> => {
      const child = await childOf(scope)
        .select('id', 'learningInsights')
        .include('helpSessions', (sessions) =>
          sessions
            .where({ tenantId, ownerId, childProfileId })
            .where((row) => row.startedAt.gte(dateToInstant(new Date(period.from))))
            .where((row) => row.startedAt.lte(dateToInstant(new Date(period.until))))
            .select(...PARENT_TASK_SELECT)
            .orderBy([(row) => row.startedAt.desc(), (row) => row.id.asc()])
            .limit(fetchLimit)
            .include('hintEvents', (hints) =>
              hints
                .select('level')
                .orderBy((row) => row.occurredAt.asc())
                .limit(evidence),
            )
            .include('childAnswers', (answers) =>
              answers
                .select('id')
                .orderBy((row) => row.occurredAt.asc())
                .limit(evidence),
            )
            .include('answerAssessments', (checks) =>
              checks
                .select('result')
                .orderBy((row) => row.occurredAt.asc())
                .limit(evidence),
            )
            .include('comprehensionQuestions', (questions) =>
              questions
                .select('repliedAt')
                .orderBy((row) => row.occurredAt.asc())
                .limit(evidence),
            ),
        )
        .include('membership', (membership) =>
          membership
            .where({ tenantId })
            .select('classroomId')
            .include('classroom', (classroom) =>
              classroom
                .where({ tenantId, status: 'ACTIVE' })
                .select('subject')
                .include('assignments', (assignments) =>
                  assignments
                    .where({ tenantId })
                    .select('id', 'title', 'dueDate')
                    .orderBy([(row) => row.createdAt.desc(), (row) => row.id.asc()])
                    .limit(fetchLimit)
                    .include('helpSessions', (sessions) =>
                      sessions
                        .where({ tenantId, ownerId, childProfileId })
                        .select('status')
                        .limit(fetchLimit),
                    ),
                ),
            ),
        )
        .first();
      const tasks = child?.helpSessions ?? [];
      const classroom = child?.membership?.classroom;
      const assignments = classroom?.assignments ?? [];
      const insights = scope.includeInsights && child?.learningInsights === true;
      const shown = tasks.slice(0, recordLimit);
      return {
        tasks: shown.map((record) => toParentTask(record, insights, scope.evidenceLimit)),
        assignments: assignments.slice(0, recordLimit).flatMap((assignment) =>
          classroom
            ? [
                {
                  id: assignment.id,
                  title: assignment.title,
                  dueDate: assignment.dueDate,
                  subject: classroom.subject,
                  started: assignment.helpSessions.length > 0,
                  completed: assignment.helpSessions.some(
                    (session) => session.status === 'COMPLETED',
                  ),
                  progressPartial: assignment.helpSessions.length > recordLimit,
                },
              ]
            : [],
        ),
        tasksTruncated: tasks.length > recordLimit,
        assignmentsTruncated: assignments.length > recordLimit,
      };
    }, failures.infraOnly('list'));
  }

  findTask(scope: ParentLearningScope, id: ParentTaskId) {
    const { tenantId, ownerId, childProfileId } = scope;
    const evidence = evidenceRows(scope);
    return fromThrowableAsync(async () => {
      const child = await childOf(scope)
        .select('learningInsights')
        .include('helpSessions', (sessions) =>
          sessions
            .where({ id, tenantId, ownerId, childProfileId })
            .select(...PARENT_TASK_SELECT)
            .limit(1)
            .include('assignment', (assignment) =>
              assignment
                .where({ tenantId })
                .select('title')
                .include('classroom', (classroom) =>
                  classroom.where({ tenantId }).select('subject'),
                ),
            )
            .include('hintEvents', (hints) =>
              hints
                .select('level')
                .orderBy((row) => row.occurredAt.asc())
                .limit(evidence),
            )
            .include('childAnswers', (answers) =>
              answers
                .select('id')
                .orderBy((row) => row.occurredAt.asc())
                .limit(evidence),
            )
            .include('answerAssessments', (checks) =>
              checks
                .select('result')
                .orderBy((row) => row.occurredAt.asc())
                .limit(evidence),
            )
            .include('comprehensionQuestions', (questions) =>
              questions
                .select('repliedAt')
                .orderBy((row) => row.occurredAt.asc())
                .limit(evidence),
            ),
        )
        .first();
      if (child === null) {
        return null;
      }
      const task = child.helpSessions[0];
      if (!task) {
        return null;
      }
      const { assignment } = task;
      const insights = scope.includeInsights && child.learningInsights;
      return {
        ...toParentTask(task, insights, scope.evidenceLimit),
        assignment: assignment?.classroom
          ? { title: assignment.title, subject: assignment.classroom.subject }
          : null,
      };
    }, failures.infraOnly('findTask'));
  }
}
