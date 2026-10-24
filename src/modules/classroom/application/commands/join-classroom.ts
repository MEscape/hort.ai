import type { Actor } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import { ResultAsync, errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  childAlreadyInClassroom,
  fromRateLimitFailure,
  inviteCodeInvalid,
} from '../../domain/errors/classroom-errors';
import { parseChildProfileId } from '../../domain/models/ids';
import { normalizeInviteCode } from '../../domain/models/invite-code';
import { toChildClassroomView } from '../classroom-view-mappers';
import { CLASSROOM_RATE_LIMITS } from '../rate-limits';

import type { Classroom } from '../../domain/models/classroom';
import type { ChildProfileId } from '../../domain/models/ids';
import type { ChildProfileAccessError } from '../../domain/ports/child-profile-access.port';
import type { ClassroomDependencies } from '../classroom-dependencies';
import type { ChildClassroomView, JoinClassroomInput } from '../contracts/classroom-views';

export type JoinClassroomError =
  ChildProfileAccessError | RateLimitedAppError | ConflictAppError | InfrastructureAppError;

/** The address budget first, then the parent's own (adding-a-rate-limit.md). */
function enforceJoinBudget(
  deps: ClassroomDependencies,
  actor: Actor,
): AppResultAsync<void, RateLimitedAppError | InfrastructureAppError> {
  return ResultAsync.fromSafePromise(deps.clientAddress.current())
    .andThen((client) =>
      deps.rateLimiter.enforceAll([
        { policy: CLASSROOM_RATE_LIMITS.joinByCodeClient, subject: client },
        {
          policy: CLASSROOM_RATE_LIMITS.joinByCode,
          subject: { kind: 'actor', tenantId: actor.tenantId, actorId: actor.id },
        },
      ]),
    )
    .map(() => undefined)
    .mapErr(fromRateLimitFailure);
}

/**
 * The active class whose CURRENT code this is. Malformed, unknown, replaced and archived all end
 * the same way, and the refusal is audited without the code (it may be a guess at someone's code).
 */
function findClassroomByCode(
  deps: ClassroomDependencies,
  actor: Actor,
  rawCode: string,
): AppResultAsync<Classroom, ChildProfileAccessError> {
  const refuse = () => {
    deps.audit.record({
      type: 'classroom.join_refused',
      actorId: actor.id,
      tenantId: actor.tenantId,
      reason: 'invite_code_invalid',
    });
    return errAsync(inviteCodeInvalid());
  };
  const code = normalizeInviteCode(rawCode);
  if (code === null) {
    return refuse();
  }
  return deps.classrooms
    .findActiveByInviteCodeHash(deps.inviteCodes.hashOf(code), actor.tenantId)
    .andThen((classroom) => (classroom === null ? refuse() : okAsync(classroom)));
}

/**
 * At most one class per child (B S, #8). Joining the class the child is already in changes
 * nothing; another class is refused, so a mistyped code never moves a child silently. The parent
 * removes the child from the old class first. The class's federal state and grade are copied into
 * the profile; if that fails, the membership is taken back so no half-done join remains.
 */
function joinOnce(
  deps: ClassroomDependencies,
  actor: Actor,
  target: { readonly childProfileId: ChildProfileId; readonly classroom: Classroom },
): AppResultAsync<ChildClassroomView, JoinClassroomError> {
  const { classrooms, childProfiles, audit } = deps;
  const { childProfileId, classroom } = target;
  return classrooms
    .findMembershipOfChild(childProfileId, actor.tenantId)
    .andThen((current): AppResultAsync<ChildClassroomView, JoinClassroomError> => {
      if (current !== null) {
        if (current.classroom.id === classroom.id) {
          return okAsync(toChildClassroomView(current));
        }
        audit.record({
          type: 'classroom.join_refused',
          actorId: actor.id,
          tenantId: actor.tenantId,
          reason: 'child_already_in_classroom',
        });
        return errAsync(childAlreadyInClassroom());
      }
      return classrooms
        .addMember({ tenantId: actor.tenantId, classroomId: classroom.id, childProfileId })
        .andThen((joinedAt) =>
          childProfiles
            .adoptClassroomSettings(childProfileId, {
              federalState: classroom.federalState,
              grade: classroom.grade,
            })
            .orElse((error) =>
              classrooms
                .removeMemberOfChild(childProfileId, actor.tenantId)
                .andThen(() => errAsync(error)),
            )
            .map(() => joinedAt),
        )
        .map((joinedAt) => {
          audit.record({
            type: 'classroom.child_joined',
            actorId: actor.id,
            tenantId: actor.tenantId,
            classroomId: classroom.id,
            childProfileId,
          });
          return toChildClassroomView({ classroom, joinedAt });
        });
    });
}

/**
 * A parent puts their own child into a class with the class's invite code (#32).
 *
 * Authorized as an update of the child (`learner.update`): the learner module decides on the stored
 * profile that it is this parent's. Every attempt, right or wrong, spends the join budget.
 */
export class JoinClassroom {
  constructor(private readonly deps: ClassroomDependencies) {}

  execute(input: JoinClassroomInput): AppResultAsync<ChildClassroomView, JoinClassroomError> {
    const { authorization, childProfiles } = this.deps;

    return authorization.requireInTenant('learner.update').andThen((actor) =>
      enforceJoinBudget(this.deps, actor)
        .andThen(() => parseChildProfileId(input.childProfileId))
        .andThen((childProfileId) =>
          childProfiles.requireOwnChild(childProfileId).map(() => childProfileId),
        )
        .andThen((childProfileId) =>
          findClassroomByCode(this.deps, actor, input.inviteCode).andThen((classroom) =>
            joinOnce(this.deps, actor, { childProfileId, classroom }),
          ),
        ),
    );
  }
}
