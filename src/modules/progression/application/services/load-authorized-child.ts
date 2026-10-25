import type { Actor, AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { childNotFound } from '../../domain/errors/progression-errors';
import { parseChildProfileId } from '../../domain/models/ids';

import type { ChildProfileId } from '../../domain/models/ids';
import type { ProgressionDependencies } from '../progression-dependencies';

/** Everything an operation on one child can fail with. */
export type LoadChildError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

interface AuthorizedChild {
  readonly actor: Actor;
  readonly childProfileId: ChildProfileId;
}

/**
 * The shared first half of every progression use case:
 *
 *  1. `requireInTenant` FIRST, so a caller without the permission learns nothing about which ids exist.
 *  2. Ask the learner module whether the signed-in parent owns the child: another parent's id, like
 *     an unknown one, is simply "not found" with the same answer, and nothing is read or written.
 */
export function loadAuthorizedChild(
  deps: ProgressionDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<AuthorizedChild, LoadChildError> {
  const { authorization, children } = deps;

  return authorization
    .requireInTenant(permission)
    .andThen((actor) =>
      parseChildProfileId(rawId).asyncAndThen((childProfileId) =>
        children
          .ownsChild(childProfileId)
          .andThen((owns): AppResultAsync<AuthorizedChild, NotFoundAppError> =>
            owns ? okAsync({ actor, childProfileId }) : errAsync(childNotFound()),
          ),
      ),
    );
}
