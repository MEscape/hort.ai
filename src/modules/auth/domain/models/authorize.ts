import { isDefined } from '@lib/utils';

import { PLATFORM_ADMIN_ROLE, permissionsForRole } from './role';

import type { Actor } from './actor';
import type { ActorId, TenantId } from './ids';
import type { Permission } from './permission';

/**
 * What the actor is trying to touch: the tenant and the parent who owns the resource (a child
 * profile's guardian, progress through its profile). Both come from the LOADED resource, never from
 * a request field: that is what makes cross-tenant and cross-parent access a comparison rather
 * than trust. A resource id the client knows grants nothing.
 */
export interface ResourceScope {
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
}

/**
 * Why access was refused. Internal only: it feeds the audit log and must
 * never reach a client, because telling the reasons apart discloses whether a
 * resource exists for another parent.
 */
export type DenialReason = 'tenant_mismatch' | 'owner_mismatch' | 'permission_missing';

export type AuthorizationDecision =
  { readonly isAllowed: true } | { readonly isAllowed: false; readonly reason: DenialReason };

/**
 * Whether the actor holds `permission` through any of their roles. This is
 * a union over roles, computed here rather than delegated, so the result
 * cannot change because a provider changes how it combines roles.
 */
export function actorHasPermission(actor: Actor, permission: Permission): boolean {
  return actor.roles.some((role) => permissionsForRole(role).includes(permission));
}

/**
 * The authorization decision. Order matters and is fail-closed:
 *
 *  1. Tenant first. A resource in another tenant is denied before anything else.
 *  2. Then the owner. A parent holds the permission for their own learners only; being a parent
 *     grants nothing on another parent's. A platform admin is exempt here, never from the tenant.
 *  3. Then the permission, through the actor's roles.
 *
 * `scope` present means the operation targets a specific resource. Absent
 * means it is not tied to one (create, or list the actor's own). The application layer exposes
 * these as two distinct calls so a caller cannot drop the scope by accident.
 */
export function decide(
  actor: Actor,
  permission: Permission,
  scope?: ResourceScope,
): AuthorizationDecision {
  if (isDefined(scope)) {
    if (scope.tenantId !== actor.tenantId) {
      return { isAllowed: false, reason: 'tenant_mismatch' };
    }
    if (scope.ownerId !== actor.id && !actor.roles.includes(PLATFORM_ADMIN_ROLE)) {
      return { isAllowed: false, reason: 'owner_mismatch' };
    }
  }
  if (!actorHasPermission(actor, permission)) {
    return { isAllowed: false, reason: 'permission_missing' };
  }
  return { isAllowed: true };
}
