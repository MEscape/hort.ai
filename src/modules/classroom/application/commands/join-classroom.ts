import type { Actor } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import { ResultAsync, errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  CLASSROOM_ERROR_CODES,
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

/** `isNew` is false when the child already was in this very class. */
interface JoinOutcome {
  readonly view: ChildClassroomView;
  readonly isNew: boolean;
}

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

/** The class a code currently admits to, with the code's hash for the re-check under the lock. */
interface CodedClassroom {
  readonly classroom: Classroom;
  readonly inviteCodeHash: string;
}

/**
 * The active class whose CURRENT, unexpired code this is. Malformed, unknown, replaced, expired
 * and archived all end the same way (`inviteCodeInvalid`, audited by the caller without the code:
 * it may be a guess at someone's code).
 */
function findClassroomByCode(
  deps: ClassroomDependencies,
  actor: Actor,
  rawCode: string,
): AppResultAsync<CodedClassroom, ChildProfileAccessError> {
  const code = normalizeInviteCode(rawCode);
  if (code === null) {
    return errAsync(inviteCodeInvalid());
  }
  const inviteCodeHash = deps.inviteCodes.hashOf(code);
  return deps.classrooms
    .findActiveByInviteCodeHash(inviteCodeHash, actor.tenantId)
    .andThen((classroom) =>
      classroom === null ? errAsync(inviteCodeInvalid()) : okAsync({ classroom, inviteCodeHash }),
    );
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
  target: { readonly childProfileId: ChildProfileId } & CodedClassroom,
): AppResultAsync<JoinOutcome, JoinClassroomError> {
  const { classrooms, childProfiles, audit } = deps;
  const { childProfileId, classroom, inviteCodeHash } = target;
  return classrooms
    .findMembershipOfChild(childProfileId, actor.tenantId)
    .andThen((current): AppResultAsync<JoinOutcome, JoinClassroomError> => {
      if (current !== null) {
        if (current.classroom.id === classroom.id) {
          return okAsync({ view: toChildClassroomView(current), isNew: false });
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
        .addMember({
          tenantId: actor.tenantId,
          classroomId: classroom.id,
          childProfileId,
          // Re-checked under the class's lock: the code may be replaced or expire meanwhile.
          inviteCodeHash,
        })
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
        .map((joinedAt) => ({ view: toChildClassroomView({ classroom, joinedAt }), isNew: true }));
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
    const { authorization, childProfiles, audit } = this.deps;

    return authorization.requireInTenant('learner.update').andThen((actor) =>
      enforceJoinBudget(this.deps, actor)
        .andThen(() => parseChildProfileId(input.childProfileId))
        .andThen((childProfileId) =>
          childProfiles.requireOwnChild(childProfileId).map(() => childProfileId),
        )
        .andThen((childProfileId) =>
          findClassroomByCode(this.deps, actor, input.inviteCode)
            .andThen((coded) =>
              joinOnce(this.deps, actor, { childProfileId, ...coded }).map(({ view, isNew }) => {
                if (isNew) {
                  audit.record({
                    type: 'classroom.child_joined',
                    actorId: actor.id,
                    tenantId: actor.tenantId,
                    classroomId: coded.classroom.id,
                    childProfileId,
                  });
                }
                return view;
              }),
            )
            .mapErr((error) => {
              // At lookup or, when the code changed meanwhile, under the class lock.
              if (error.code === CLASSROOM_ERROR_CODES.inviteCodeInvalid) {
                audit.record({
                  type: 'classroom.join_refused',
                  actorId: actor.id,
                  tenantId: actor.tenantId,
                  reason: 'invite_code_invalid',
                });
              }
              return error;
            }),
        ),
    );
  }
}
