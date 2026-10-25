import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { summarizeClass } from '../../domain/insights/class-overview';
import { parseClassroomId } from '../../domain/models/ids';
import { INSIGHT_READ_BOUNDS } from '../guidance-limits';

import type { ClassLearningOverviewView } from '../contracts/insight-views';
import type { InsightDependencies } from '../insight-dependencies';

export type GetClassLearningOverviewError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * The teacher's overview of one of their classes (#35): per assignment, how many children got help,
 * how many finished it and the typical number of hints. Only numbers over at least three children
 * leave this query; no child id, name or text does. Learning data only as class aggregates (#32).
 *
 * The assignments module lists the class's assignments only for its own teacher, so another
 * teacher's class (or a guess) has no overview: `null`. A child can start a session on an assignment
 * only while it is a member of the class (`GetAssignmentForHelp`, #33).
 */
export class GetClassLearningOverview {
  constructor(private readonly deps: InsightDependencies) {}

  execute(
    classroomId: string,
  ): AppResultAsync<ClassLearningOverviewView | null, GetClassLearningOverviewError> {
    const { authorization, assignments, records } = this.deps;
    return authorization.requireInTenant('assignment.read').andThen(() =>
      parseClassroomId(classroomId)
        .asyncAndThen((id) => assignments.ofOwnClass(id))
        .andThen((own) => {
          if (own === null) {
            return okAsync(null);
          }
          if (own.length === 0) {
            return okAsync({ assignments: [] });
          }
          return records
            .listAssignmentSessions(
              own.map(({ id }) => id),
              INSIGHT_READ_BOUNDS,
            )
            .map((sessions) => ({ assignments: summarizeClass(own, sessions) }));
        }),
    );
  }
}
