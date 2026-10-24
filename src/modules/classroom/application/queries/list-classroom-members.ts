import type { AppResultAsync } from '@lib/result';

import { MAX_CLASS_MEMBER_LIST_LIMIT } from '../classroom-limits';
import { toClassMemberView } from '../classroom-view-mappers';
import { loadAuthorizedClassroom } from '../load-authorized-classroom';

import type { ClassroomDependencies } from '../classroom-dependencies';
import type { ClassMemberView } from '../contracts/classroom-views';
import type { LoadClassroomError } from '../load-authorized-classroom';

/**
 * The children of one of the signed-in teacher's own classes, by display name only (#32): no
 * federal state, grade, companion, consent or parent. Another teacher's class is refused.
 */
export class ListClassroomMembers {
  constructor(private readonly deps: ClassroomDependencies) {}

  execute(classroomId: string): AppResultAsync<readonly ClassMemberView[], LoadClassroomError> {
    return loadAuthorizedClassroom(this.deps, classroomId, 'classroom.read')
      .andThen(({ actor, classroom }) =>
        this.deps.classrooms.listMembers(classroom.id, actor.tenantId, MAX_CLASS_MEMBER_LIST_LIMIT),
      )
      .map((members) => members.map(toClassMemberView));
  }
}
