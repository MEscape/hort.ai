import type { ConflictAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { formatInviteCode } from '../../domain/models/invite-code';
import { toClassroomView } from '../classroom-view-mappers';
import { loadAuthorizedClassroom, requireActive } from '../load-authorized-classroom';

import type { ClassroomDependencies } from '../classroom-dependencies';
import type { ClassroomIdInput, ClassroomWithInviteCodeView } from '../contracts/classroom-views';
import type { LoadClassroomError } from '../load-authorized-classroom';

/**
 * Gives one of the teacher's own active classes a new invite code. The old code is invalid from
 * the same write on; children already in the class stay in it. Since only a hash is stored, this is
 * also how a teacher sees a code again.
 */
export class RegenerateInviteCode {
  constructor(private readonly deps: ClassroomDependencies) {}

  execute(
    input: ClassroomIdInput,
  ): AppResultAsync<ClassroomWithInviteCodeView, LoadClassroomError | ConflictAppError> {
    const { classrooms, inviteCodes, audit } = this.deps;

    return loadAuthorizedClassroom(this.deps, input.id, 'classroom.update')
      .andThen(requireActive)
      .andThen(({ actor, classroom }) => {
        const issued = inviteCodes.issue();
        return classrooms
          .replaceInviteCode(classroom.id, actor.tenantId, issued.hash)
          .map((updated) => {
            audit.record({
              type: 'classroom.invite_code_regenerated',
              actorId: actor.id,
              tenantId: actor.tenantId,
              classroomId: updated.id,
            });
            return {
              classroom: toClassroomView(updated),
              inviteCode: formatInviteCode(issued.code),
            };
          });
      });
  }
}
