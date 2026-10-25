import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseChildProfileId } from '../../domain/models/ids';
import { ASSIGNMENT_LIST_LIMIT } from '../assignment-limits';
import { toChildAssignmentView } from '../assignment-view-mappers';

import type { ClassroomAccessError } from '../../domain/ports/classroom-access.port';
import type { AssignmentsDependencies } from '../assignments-dependencies';
import type { ChildAssignmentView } from '../contracts/assignment-views';

/**
 * The assignments of the class the signed-in parent's child is in, as the child sees them.
 *
 * `learner.read` is the parent's permission over their own child; the classroom module then
 * refuses another parent's child and returns the class only for a current member. Only that
 * class's assignments are read, without the solution key. A child in no class has none.
 */
export class ListChildAssignments {
  constructor(private readonly deps: AssignmentsDependencies) {}

  execute(
    rawChildProfileId: string,
  ): AppResultAsync<readonly ChildAssignmentView[], ClassroomAccessError> {
    const { authorization, classrooms, assignments } = this.deps;

    return authorization.requireInTenant('learner.read').andThen((actor) =>
      parseChildProfileId(rawChildProfileId)
        .asyncAndThen((childProfileId) => classrooms.findClassroomOfChild(childProfileId))
        .andThen((classroomId) =>
          classroomId === null
            ? okAsync([])
            : assignments.listForChild(classroomId, actor.tenantId, ASSIGNMENT_LIST_LIMIT),
        )
        .map((items) => items.map(toChildAssignmentView)),
    );
  }
}
