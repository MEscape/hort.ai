import type { AppResultAsync } from '@lib/result';

import { parseChildProfileId } from '../../domain/models/ids';
import { toChildClassroomView } from '../classroom-view-mappers';

import type { ChildProfileAccessError } from '../../domain/ports/child-profile-access.port';
import type { ClassroomDependencies } from '../classroom-dependencies';
import type { ChildClassroomView } from '../contracts/classroom-views';

/** The class the signed-in parent's child is in, or `null`. Another parent's child is refused. */
export class GetChildClassroom {
  constructor(private readonly deps: ClassroomDependencies) {}

  execute(
    rawChildProfileId: string,
  ): AppResultAsync<ChildClassroomView | null, ChildProfileAccessError> {
    const { authorization, childProfiles, classrooms } = this.deps;

    return authorization.requireInTenant('learner.read').andThen((actor) =>
      parseChildProfileId(rawChildProfileId)
        .asyncAndThen((childProfileId) =>
          childProfiles.requireOwnChild(childProfileId).map(() => childProfileId),
        )
        .andThen((childProfileId) =>
          classrooms.findMembershipOfChild(childProfileId, actor.tenantId),
        )
        .map((membership) => (membership === null ? null : toChildClassroomView(membership))),
    );
  }
}
