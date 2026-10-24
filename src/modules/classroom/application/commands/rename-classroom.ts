import type { ConflictAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { parseClassroomName } from '../../domain/models/classroom';
import { toClassroomView } from '../classroom-view-mappers';
import { loadAuthorizedClassroom, requireActive } from '../load-authorized-classroom';

import type { ClassroomDependencies } from '../classroom-dependencies';
import type { ClassroomView, RenameClassroomInput } from '../contracts/classroom-views';
import type { LoadClassroomError } from '../load-authorized-classroom';

/** Renames one of the teacher's own active classes. */
export class RenameClassroom {
  constructor(private readonly deps: ClassroomDependencies) {}

  execute(
    input: RenameClassroomInput,
  ): AppResultAsync<ClassroomView, LoadClassroomError | ConflictAppError> {
    const { classrooms, audit } = this.deps;

    return loadAuthorizedClassroom(this.deps, input.id, 'classroom.update')
      .andThen(requireActive)
      .andThen(({ actor, classroom }) =>
        parseClassroomName(input.name)
          .asyncAndThen((name) => classrooms.rename(classroom.id, actor.tenantId, name))
          .map((renamed) => {
            audit.record({
              type: 'classroom.renamed',
              actorId: actor.id,
              tenantId: actor.tenantId,
              classroomId: renamed.id,
            });
            return toClassroomView(renamed);
          }),
      );
  }
}
