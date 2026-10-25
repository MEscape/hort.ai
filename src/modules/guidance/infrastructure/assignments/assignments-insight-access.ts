import { assignmentsQueries } from '@modules/assignments';

import type { InsightAssignments } from '../../domain/ports/insight-sources.port';

/**
 * Assignment titles over the assignments module's queries, which authorize every read: the
 * parent's own child's class (`learner.read`), the teacher's own class (`assignment.read`). The
 * overview falls back to the teacher's newest class for an id that is not theirs, so only an exact
 * match counts. Titles and ids only; the task text and the key are dropped here.
 */
export const assignmentsInsightAccess: InsightAssignments = {
  titlesForChild: (childProfileId) =>
    assignmentsQueries.listChildAssignments
      .execute(childProfileId)
      .map((items) => new Map(items.map(({ id, title }) => [id, title]))),
  ofOwnClass: (classroomId) =>
    assignmentsQueries.getTeacherAssignmentOverview
      .execute(classroomId)
      .map((overview) =>
        overview.selectedClassroomId === classroomId
          ? overview.assignments.map(({ id, title }) => ({ id, title }))
          : null,
      ),
};
