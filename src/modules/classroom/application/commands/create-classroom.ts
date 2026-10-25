import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createClassroomDraft } from '../../domain/models/classroom';
import { formatInviteCode } from '../../domain/models/invite-code';
import { toClassroomView } from '../classroom-view-mappers';

import type { ClassroomDependencies } from '../classroom-dependencies';
import type {
  ClassroomWithInviteCodeView,
  CreateClassroomInput,
} from '../contracts/classroom-views';

/**
 * Creates a class owned by the signed-in teacher, with a fresh invite code. The code is returned
 * this once; only its hash is stored.
 */
export class CreateClassroom {
  constructor(private readonly deps: ClassroomDependencies) {}

  execute(
    input: CreateClassroomInput,
  ): AppResultAsync<
    ClassroomWithInviteCodeView,
    AuthorizationError | InfrastructureAppError | ValidationAppError
  > {
    const { authorization, classrooms, inviteCodes, audit } = this.deps;

    return authorization.requireInTenant('classroom.create').andThen((actor) =>
      createClassroomDraft(input).asyncAndThen((draft) => {
        const issued = inviteCodes.issue();
        return classrooms
          .create({
            tenantId: actor.tenantId,
            ownerId: actor.id,
            draft,
            inviteCodeHash: issued.hash,
          })
          .map((classroom) => {
            audit.record({
              type: 'classroom.created',
              actorId: actor.id,
              tenantId: actor.tenantId,
              classroomId: classroom.id,
            });
            return {
              classroom: toClassroomView(classroom),
              inviteCode: formatInviteCode(issued.code),
            };
          });
      }),
    );
  }
}
