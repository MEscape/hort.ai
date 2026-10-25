import type { ForbiddenAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { isDefined } from '@lib/utils';

import { permissionDenied } from '../domain/errors/auth-errors';
import { decide } from '../domain/models/authorize';

import type { Actor } from '../domain/models/actor';
import type { ResourceScope } from '../domain/models/authorize';
import type { Permission } from '../domain/models/permission';
import type {
  CurrentActorError,
  CurrentActorProvider,
} from '../domain/ports/current-actor-provider.port';
import type { SecurityAuditLog } from '../domain/ports/security-audit-log.port';

/** Everything `require*` can fail with; nothing provider-specific. */
export type AuthorizationError = CurrentActorError | ForbiddenAppError;

/**
 * What a protected use case depends on. Use cases receive this, never a
 * Better Auth import and never a session object.
 *
 * Every protected use case calls one of these itself. A Server Action,
 * Route Handler or proxy having checked earlier is defense in depth only,
 * and a direct invocation of the use case must still be refused.
 *
 * The two methods are separate on purpose: whether an operation targets a
 * specific resource is a decision the caller must make explicitly, not an
 * optional argument that can be forgotten.
 */
export interface AuthorizationService {
  /**
   * For operations not tied to an existing resource: create, or list the
   * actor's own. Call it FIRST, before loading anything, so a caller without the permission
   * cannot probe for existence.
   *
   * The returned actor is the authoritative owner and tenant for what the use case creates or
   * lists: store `actor.id` as the owner and look resources up by it, so another parent's id is
   * simply "not found".
   */
  requireInTenant(permission: Permission): AppResultAsync<Actor, AuthorizationError>;

  /**
   * For operations on a loaded resource. `resource.tenantId` and `resource.ownerId` must come from
   * the stored record, never from the request. This is the backstop behind owner-scoped lookups:
   * if a repository ever returns another parent's record, this refuses it.
   */
  requireOnResource(
    permission: Permission,
    resource: ResourceScope,
  ): AppResultAsync<Actor, AuthorizationError>;
}

/**
 * Builds the service over a resolved actor and an audit sink. Every denial
 * is audited with its precise reason; the caller only ever sees the single
 * `permissionDenied` error.
 */
export function createAuthorizationService(deps: {
  readonly currentActor: CurrentActorProvider;
  readonly audit: SecurityAuditLog;
}): AuthorizationService {
  function authorize(
    permission: Permission,
    scope?: ResourceScope,
  ): AppResultAsync<Actor, AuthorizationError> {
    return deps.currentActor
      .getCurrentActor()
      .andThen((actor): AppResultAsync<Actor, AuthorizationError> => {
        const decision = decide(actor, permission, scope);
        if (decision.isAllowed) {
          // Only a platform admin is ever allowed past a foreign owner (see `decide`).
          if (isDefined(scope) && scope.ownerId !== actor.id) {
            deps.audit.record({
              type: 'authorization.admin_override',
              actorId: actor.id,
              tenantId: actor.tenantId,
              permission,
              ownerId: scope.ownerId,
            });
          }
          return okAsync(actor);
        }

        deps.audit.record({
          type: 'authorization.denied',
          actorId: actor.id,
          tenantId: actor.tenantId,
          permission,
          reason: decision.reason,
        });
        return errAsync(permissionDenied());
      });
  }

  return {
    requireInTenant: (permission) => authorize(permission),
    requireOnResource: (permission, resource) => authorize(permission, resource),
  };
}
