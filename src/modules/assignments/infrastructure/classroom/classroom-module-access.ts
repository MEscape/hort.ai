import type { ChildClassroomView, ClassroomView } from '@modules/classroom';

import type { AppResultAsync } from '@lib/result';

import { toClassroomId } from '../../domain/models/ids';

import type { ChildProfileId, ClassroomId } from '../../domain/models/ids';
import type {
  ClassroomAccess,
  ClassroomAccessError,
  OwnClassroom,
} from '../../domain/ports/classroom-access.port';

/** The classroom queries this module needs, as the classroom module's public API offers them. */
export interface ClassroomUseCases {
  readonly listClassrooms: {
    execute(): AppResultAsync<readonly ClassroomView[], ClassroomAccessError>;
  };
  readonly getClassroomById: {
    execute(id: string): AppResultAsync<ClassroomView, ClassroomAccessError>;
  };
  readonly getChildClassroom: {
    execute(
      childProfileId: string,
    ): AppResultAsync<ChildClassroomView | null, ClassroomAccessError>;
  };
}

function toOwnClassroom(view: ClassroomView): OwnClassroom {
  return {
    id: toClassroomId(view.id),
    name: view.name,
    grade: view.grade,
    isActive: view.status === 'active',
  };
}

/**
 * `ClassroomAccess` over the classroom module's own queries. `listClassrooms` and
 * `getClassroomById` authorize the signed-in teacher on the stored classes (`classroom.read`);
 * `getChildClassroom` authorizes the signed-in parent on the stored child profile (`learner.read`)
 * and reads its current membership.
 */
export class ClassroomModuleAccess implements ClassroomAccess {
  constructor(private readonly classroom: ClassroomUseCases) {}

  listOwnClassrooms(): AppResultAsync<readonly OwnClassroom[], ClassroomAccessError> {
    return this.classroom.listClassrooms.execute().map((views) => views.map(toOwnClassroom));
  }

  requireOwnClassroom(
    classroomId: ClassroomId,
  ): AppResultAsync<OwnClassroom, ClassroomAccessError> {
    return this.classroom.getClassroomById.execute(classroomId).map(toOwnClassroom);
  }

  findClassroomOfChild(
    childProfileId: ChildProfileId,
  ): AppResultAsync<ClassroomId | null, ClassroomAccessError> {
    return this.classroom.getChildClassroom
      .execute(childProfileId)
      .map((membership) => (membership === null ? null : toClassroomId(membership.classroomId)));
  }
}
