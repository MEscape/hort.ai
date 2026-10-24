import type { Actor, AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { childProfileNotFound } from '../domain/errors/learner-errors';
import { parseChildProfileId } from '../domain/models/ids';

import { scopeOf } from './child-profile-scope';

import type { LearnerDependencies } from './learner-dependencies';
import type { ChildProfile } from '../domain/models/child-profile';

/** Everything an operation on one existing child profile can fail with. */
export type LoadChildProfileError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

interface AuthorizedChildProfile {
  readonly actor: Actor;
  readonly childProfile: ChildProfile;
}

/**
 * The shared first half of every operation on an existing profile:
 *
 *  1. `requireInTenant` FIRST, so a caller without the permission learns nothing about which ids exist.
 *  2. Look the profile up by (id, the actor's own id and tenant): another parent's id, like an
 *     unknown one, is simply "not found", with the same answer.
 *  3. `requireOnResource` against the STORED owner and tenant, the backstop should a repository
 *     ever return a foreign record.
 */
export function loadAuthorizedChildProfile(
  deps: LearnerDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<AuthorizedChildProfile, LoadChildProfileError> {
  const { authorization, childProfiles } = deps;

  return authorization.requireInTenant(permission).andThen((actor) =>
    parseChildProfileId(rawId)
      .asyncAndThen((id) => childProfiles.findOwned(id, actor.id, actor.tenantId))
      .andThen((childProfile): AppResultAsync<ChildProfile, NotFoundAppError> =>
        childProfile === null ? errAsync(childProfileNotFound()) : okAsync(childProfile),
      )
      .andThen((childProfile) =>
        authorization
          .requireOnResource(permission, scopeOf(childProfile))
          .map((verifiedActor) => ({ actor: verifiedActor, childProfile })),
      ),
  );
}
