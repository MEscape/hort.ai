import type { AuthorizationError, AuthorizationService } from '@modules/auth';

import type { AppResultAsync } from '@lib/result';

/**
 * Authorization for adult-only actions on a child (joining or leaving a class): the permission
 * check of `authorization`, then the short-lived parent-area password proof (`requireProof`, the
 * auth module's `RequireParentAccess`), as the learner module's adult writes do. The shared family
 * session alone is not enough: the child uses it too.
 */
export function requiringParentProof(
  authorization: AuthorizationService,
  requireProof: () => AppResultAsync<void, AuthorizationError>,
): AuthorizationService {
  return {
    requireInTenant: (permission) =>
      authorization.requireInTenant(permission).andThen((actor) => requireProof().map(() => actor)),
    requireOnResource: (permission, scope) =>
      authorization
        .requireOnResource(permission, scope)
        .andThen((actor) => requireProof().map(() => actor)),
  };
}
