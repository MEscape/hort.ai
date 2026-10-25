import type { AppResultAsync } from '@lib/result';

import { formatInviteCode, inviteCodeExpiresAt } from '../../domain/models/invite-code';
import { MAX_CLASS_MEMBER_LIST_LIMIT } from '../classroom-limits';
import { toClassMemberView, toClassroomView } from '../classroom-view-mappers';
import { loadAuthorizedClassroom } from '../load-authorized-classroom';

import type { ClassroomDependencies } from '../classroom-dependencies';
import type { ClassroomDetailsView } from '../contracts/classroom-views';
import type { LoadClassroomError } from '../load-authorized-classroom';

/**
 * One of the signed-in teacher's own classes for its details dialog: the current invite code when
 * it is sealed (opened only after the ownership check), its expiry, and the children by display
 * name. Another teacher's class is refused before anything is read. Nothing is regenerated here.
 */
export class GetClassroomDetails {
  constructor(private readonly deps: ClassroomDependencies) {}

  execute(id: string): AppResultAsync<ClassroomDetailsView, LoadClassroomError> {
    const { classrooms, inviteCodeVault, clock } = this.deps;

    return loadAuthorizedClassroom(this.deps, id, 'classroom.read').andThen(
      ({ actor, classroom }) => {
        const owner = { tenantId: actor.tenantId, ownerId: actor.id };
        return classrooms.findSealedInviteCode(classroom.id, owner).andThen((sealed) =>
          classrooms
            .listMembers(classroom.id, owner, MAX_CLASS_MEMBER_LIST_LIMIT)
            .map((members) => {
              const code = sealed === null ? null : inviteCodeVault.open(sealed, owner);
              const expiresAt = inviteCodeExpiresAt(classroom.inviteCodeIssuedAt);
              return {
                classroom: toClassroomView(classroom),
                inviteCode: code === null ? null : formatInviteCode(code),
                inviteCodeExpiresAt: expiresAt,
                isInviteCodeExpired: expiresAt.getTime() <= clock.now().getTime(),
                members: members.map(toClassMemberView),
              };
            }),
        );
      },
    );
  }
}
