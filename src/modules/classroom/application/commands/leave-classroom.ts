import type { AppResultAsync } from '@lib/result';

import { parseChildProfileId } from '../../domain/models/ids';

import type { ChildProfileAccessError } from '../../domain/ports/child-profile-access.port';
import type { ClassroomDependencies } from '../classroom-dependencies';
import type { ChildProfileIdInput } from '../contracts/classroom-views';

/**
 * A parent takes their own child out of its class. The profile keeps its federal state and grade.
 * Removing a child that is in no class succeeds and changes nothing.
 */
export class LeaveClassroom {
  constructor(private readonly deps: ClassroomDependencies) {}

  execute(input: ChildProfileIdInput): AppResultAsync<void, ChildProfileAccessError> {
    const { authorization, childProfiles, classrooms, audit } = this.deps;

    return authorization.requireInTenant('learner.update').andThen((actor) =>
      parseChildProfileId(input.childProfileId)
        .asyncAndThen((childProfileId) =>
          childProfiles.requireOwnChild(childProfileId).map(() => childProfileId),
        )
        .andThen((childProfileId) =>
          classrooms.removeMemberOfChild(childProfileId, actor.tenantId).map((removed) => {
            if (removed) {
              audit.record({
                type: 'classroom.child_left',
                actorId: actor.id,
                tenantId: actor.tenantId,
                childProfileId,
              });
            }
          }),
        ),
    );
  }
}
