import type { AppResultAsync } from '@lib/result';

import { createAssignmentDraft } from '../../domain/models/assignment';
import { toDraftInput, toTeacherAssignmentView } from '../assignment-view-mappers';
import { loadAuthorizedAssignment } from '../load-authorized-assignment';

import type { AssignmentsDependencies } from '../assignments-dependencies';
import type { TeacherAssignmentView, UpdateAssignmentInput } from '../contracts/assignment-views';
import type { LoadAssignmentError } from '../load-authorized-assignment';

/** Replaces the content of one of the signed-in teacher's own assignments. */
export class UpdateAssignment {
  constructor(private readonly deps: AssignmentsDependencies) {}

  execute(
    input: UpdateAssignmentInput,
  ): AppResultAsync<TeacherAssignmentView, LoadAssignmentError> {
    const { assignments, audit } = this.deps;

    return loadAuthorizedAssignment(this.deps, input.id, 'assignment.update').andThen(
      ({ actor, assignment }) =>
        createAssignmentDraft(toDraftInput(input))
          .asyncAndThen((draft) =>
            assignments.update(
              assignment.id,
              { tenantId: actor.tenantId, ownerId: actor.id },
              draft,
            ),
          )
          .map((updated) => {
            audit.record({
              type: 'assignment.updated',
              actorId: actor.id,
              tenantId: actor.tenantId,
              classroomId: updated.classroomId,
              assignmentId: updated.id,
            });
            return toTeacherAssignmentView(updated);
          }),
    );
  }
}
