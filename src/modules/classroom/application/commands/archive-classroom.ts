import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { toClassroomView } from '../classroom-view-mappers';
import { loadAuthorizedClassroom } from '../load-authorized-classroom';

import type { ClassroomDependencies } from '../classroom-dependencies';
import type { ClassroomIdInput, ClassroomView } from '../contracts/classroom-views';
import type { LoadClassroomError } from '../load-authorized-classroom';

/**
 * Archives one of the teacher's own classes. Its code stops working and every child leaves it
 * (the children's profiles stay as they are). Archiving an archived class changes nothing.
 */
export class ArchiveClassroom {
  constructor(private readonly deps: ClassroomDependencies) {}

  execute(input: ClassroomIdInput): AppResultAsync<ClassroomView, LoadClassroomError> {
    const { classrooms, audit } = this.deps;

    return loadAuthorizedClassroom(this.deps, input.id, 'classroom.archive')
      .andThen(({ actor, classroom }) => {
        if (classroom.status === 'archived') {
          return okAsync(classroom);
        }
        return classrooms.archive(classroom.id, actor.tenantId).map((archived) => {
          audit.record({
            type: 'classroom.archived',
            actorId: actor.id,
            tenantId: actor.tenantId,
            classroomId: archived.id,
          });
          return archived;
        });
      })
      .map(toClassroomView);
  }
}
