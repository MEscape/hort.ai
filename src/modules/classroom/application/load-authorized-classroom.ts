import type { Actor, AuthorizationError, Permission } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { classroomArchived, classroomNotFound } from '../domain/errors/classroom-errors';
import { parseClassroomId } from '../domain/models/ids';

import { scopeOf } from './classroom-scope';

import type { ClassroomDependencies } from './classroom-dependencies';
import type { Classroom } from '../domain/models/classroom';

/** Everything an operation on one existing classroom can fail with. */
export type LoadClassroomError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

export interface AuthorizedClassroom {
  readonly actor: Actor;
  readonly classroom: Classroom;
}

/**
 * The shared first half of every operation on an existing classroom:
 *
 *  1. `requireInTenant` FIRST, so a caller without the permission learns nothing about which ids
 *     exist.
 *  2. Look the classroom up by (id, actor.tenantId).
 *  3. `requireOnResource` against the STORED tenant and owner: another teacher's class is refused.
 */
export function loadAuthorizedClassroom(
  deps: ClassroomDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<AuthorizedClassroom, LoadClassroomError> {
  const { authorization, classrooms } = deps;

  return authorization.requireInTenant(permission).andThen((actor) =>
    parseClassroomId(rawId)
      .asyncAndThen((id) => classrooms.findById(id, actor.tenantId))
      .andThen((classroom): AppResultAsync<Classroom, NotFoundAppError> =>
        classroom === null ? errAsync(classroomNotFound()) : okAsync(classroom),
      )
      .andThen((classroom) =>
        authorization
          .requireOnResource(permission, scopeOf(classroom))
          .map((verifiedActor) => ({ actor: verifiedActor, classroom })),
      ),
  );
}

/** For changes an archived class no longer takes (rename, a new code). */
export function requireActive(
  loaded: AuthorizedClassroom,
): AppResultAsync<AuthorizedClassroom, ConflictAppError> {
  return loaded.classroom.status === 'active' ? okAsync(loaded) : errAsync(classroomArchived());
}
