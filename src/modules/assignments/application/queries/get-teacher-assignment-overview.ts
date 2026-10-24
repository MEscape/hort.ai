import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { ASSIGNMENT_LIST_LIMIT } from '../assignment-limits';
import { toTeacherAssignmentView } from '../assignment-view-mappers';

import type { ClassroomAccessError, OwnClassroom } from '../../domain/ports/classroom-access.port';
import type { AssignmentsDependencies } from '../assignments-dependencies';
import type { TeacherAssignmentOverview } from '../contracts/assignment-views';

/**
 * The signed-in teacher's assignment screen: their active classes, the chosen one (the requested
 * class when it is one of them, otherwise the newest) and its assignments, newest first.
 *
 * The classes come from the classroom module pinned to the teacher, so a requested id that is not
 * one of them (another teacher's class, a guess) silently falls back and reveals nothing. A parent
 * is refused (`assignment.read`) before anything is read.
 */
export class GetTeacherAssignmentOverview {
  constructor(private readonly deps: AssignmentsDependencies) {}

  execute(
    requestedClassroomId: string | undefined,
  ): AppResultAsync<TeacherAssignmentOverview, ClassroomAccessError> {
    const { authorization, classrooms, assignments } = this.deps;

    return authorization.requireInTenant('assignment.read').andThen((actor) =>
      classrooms.listOwnClassrooms().andThen((owned) => {
        const active = owned.filter((classroom) => classroom.isActive);
        const selected = active.find(({ id }) => id === requestedClassroomId) ?? active[0];
        const classroomViews = active.map(({ id, name, grade }: OwnClassroom) => ({
          id,
          name,
          grade,
        }));
        if (selected === undefined) {
          return okAsync({
            classrooms: classroomViews,
            selectedClassroomId: null,
            assignments: [],
          });
        }
        return assignments
          .listByClassroom(
            selected.id,
            { tenantId: actor.tenantId, ownerId: actor.id },
            ASSIGNMENT_LIST_LIMIT,
          )
          .map((items) => ({
            classrooms: classroomViews,
            selectedClassroomId: selected.id,
            assignments: items.map(toTeacherAssignmentView),
          }));
      }),
    );
  }
}
