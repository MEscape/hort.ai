import type { ConflictAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { classroomArchived } from '../../domain/errors/assignment-errors';
import { createAssignmentDraft } from '../../domain/models/assignment';
import { parseClassroomId } from '../../domain/models/ids';
import { toDraftInput, toTeacherAssignmentView } from '../assignment-view-mappers';

import type { ClassroomAccessError, OwnClassroom } from '../../domain/ports/classroom-access.port';
import type { AssignmentsDependencies } from '../assignments-dependencies';
import type { CreateAssignmentInput, TeacherAssignmentView } from '../contracts/assignment-views';

/**
 * Posts an assignment to one of the signed-in teacher's own classes. Owner and tenant come from
 * the authorized actor, never from the input. Only the teacher authors the content.
 */
export class CreateAssignment {
  constructor(private readonly deps: AssignmentsDependencies) {}

  execute(
    input: CreateAssignmentInput,
  ): AppResultAsync<TeacherAssignmentView, ClassroomAccessError | ConflictAppError> {
    const { authorization, classrooms, assignments, audit } = this.deps;

    return authorization.requireInTenant('assignment.create').andThen((actor) =>
      createAssignmentDraft(toDraftInput(input))
        .asyncAndThen((draft) =>
          parseClassroomId(input.classroomId)
            .asyncAndThen((classroomId) => classrooms.requireOwnClassroom(classroomId))
            .andThen((classroom): AppResultAsync<OwnClassroom, ConflictAppError> =>
              classroom.isActive ? okAsync(classroom) : errAsync(classroomArchived()),
            )
            .andThen((classroom) =>
              assignments.create({
                tenantId: actor.tenantId,
                ownerId: actor.id,
                classroomId: classroom.id,
                draft,
              }),
            ),
        )
        .map((assignment) => {
          audit.record({
            type: 'assignment.created',
            actorId: actor.id,
            tenantId: actor.tenantId,
            classroomId: assignment.classroomId,
            assignmentId: assignment.id,
          });
          return toTeacherAssignmentView(assignment);
        }),
    );
  }
}
