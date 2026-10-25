import type { Actor, AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { assignmentNotFound } from '../domain/errors/assignment-errors';
import { parseAssignmentId } from '../domain/models/ids';

import { scopeOf } from './assignment-scope';

import type { AssignmentsDependencies } from './assignments-dependencies';
import type { Assignment } from '../domain/models/assignment';

/** Everything an operation on one existing assignment can fail with. */
export type LoadAssignmentError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

export interface AuthorizedAssignment {
  readonly actor: Actor;
  readonly assignment: Assignment;
}

/**
 * The shared first half of every operation on an existing assignment:
 *
 *  1. `requireInTenant` FIRST, so a caller without the permission (a parent) learns nothing about
 *     which ids exist.
 *  2. Look the assignment up by (id, actor.tenantId).
 *  3. `requireOnResource` against the STORED tenant and owner: another teacher's assignment is
 *     refused (and audited), never returned. Writes stay pinned to the owner as well.
 */
export function loadAuthorizedAssignment(
  deps: AssignmentsDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<AuthorizedAssignment, LoadAssignmentError> {
  const { authorization, assignments } = deps;

  return authorization.requireInTenant(permission).andThen((actor) =>
    parseAssignmentId(rawId)
      .asyncAndThen((id) => assignments.findInTenant(id, actor.tenantId))
      .andThen((assignment): AppResultAsync<Assignment, NotFoundAppError> =>
        assignment === null ? errAsync(assignmentNotFound()) : okAsync(assignment),
      )
      .andThen((assignment) =>
        authorization
          .requireOnResource(permission, scopeOf(assignment))
          .map((verifiedActor) => ({ actor: verifiedActor, assignment })),
      ),
  );
}
