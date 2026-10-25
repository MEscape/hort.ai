import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { assignmentNotFound } from '../../domain/errors/assignment-errors';
import { parseAssignmentId, parseChildProfileId } from '../../domain/models/ids';
import { toAssignmentForHelpView } from '../assignment-view-mappers';

import type { ClassroomAccessError } from '../../domain/ports/classroom-access.port';
import type { AssignmentsDependencies } from '../assignments-dependencies';
import type { AssignmentForHelpView } from '../contracts/assignment-views';

export interface AssignmentForHelpInput {
  readonly childProfileId: string;
  readonly assignmentId: string;
}

/**
 * One assignment of the class the signed-in parent's child is in, with the teacher's solution key,
 * for the help on it (#33). Server-side only: the guidance module calls it to start a help session
 * on the assignment and to check each hint and answer against the key; no browser response carries it.
 *
 * `learner.read` is the parent's permission over their own child; the classroom module then
 * refuses another parent's child and returns the class only for a current member. An assignment of
 * another class, a deleted one, or any while the child is in no class is `assignments.not_found`,
 * so an id of another class discloses nothing.
 */
export class GetAssignmentForHelp {
  constructor(private readonly deps: AssignmentsDependencies) {}

  execute(
    input: AssignmentForHelpInput,
  ): AppResultAsync<AssignmentForHelpView, ClassroomAccessError> {
    const { authorization, classrooms, assignments } = this.deps;

    return authorization.requireInTenant('learner.read').andThen((actor) =>
      parseChildProfileId(input.childProfileId)
        .andThen((childProfileId) =>
          parseAssignmentId(input.assignmentId).map((id) => ({ childProfileId, id })),
        )
        .asyncAndThen(({ childProfileId, id }) =>
          classrooms
            .findClassroomOfChild(childProfileId)
            .andThen((classroomId) =>
              classroomId === null
                ? okAsync(null)
                : assignments.findForHelp(id, classroomId, actor.tenantId),
            ),
        )
        .andThen((assignment) =>
          assignment === null
            ? errAsync(assignmentNotFound())
            : okAsync(toAssignmentForHelpView(assignment)),
        ),
    );
  }
}
