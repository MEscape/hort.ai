import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedAssignment } from '../load-authorized-assignment';

import type { AssignmentsDependencies } from '../assignments-dependencies';
import type { AssignmentIdInput } from '../contracts/assignment-views';
import type { LoadAssignmentError } from '../load-authorized-assignment';

/** Deletes one of the signed-in teacher's own assignments; another teacher's is not found. */
export class DeleteAssignment {
  constructor(private readonly deps: AssignmentsDependencies) {}

  execute(input: AssignmentIdInput): AppResultAsync<void, LoadAssignmentError> {
    const { assignments, audit } = this.deps;

    return loadAuthorizedAssignment(this.deps, input.id, 'assignment.delete').andThen(
      ({ actor, assignment }) =>
        assignments
          .deleteById(assignment.id, { tenantId: actor.tenantId, ownerId: actor.id })
          .map(() => {
            audit.record({
              type: 'assignment.deleted',
              actorId: actor.id,
              tenantId: actor.tenantId,
              classroomId: assignment.classroomId,
              assignmentId: assignment.id,
            });
          }),
    );
  }
}
