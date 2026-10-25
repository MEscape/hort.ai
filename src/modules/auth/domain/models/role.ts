import { PERMISSIONS } from './permission';

import type { Permission } from './permission';

/**
 * The one role of the first release: the parent or guardian who owns an account. Children are
 * profiles of a parent, not accounts, so there is no child role. A second role is added here
 * together with its row in `ROLE_PERMISSIONS`, which fails to compile until it has one.
 */
export const PARENT_ROLE = 'parent';

/**
 * Operates the platform: holds every permission on any parent's resources of its own tenant (`decide`
 * skips the owner comparison for it, and the authorization service audits each such access). The
 * provider grants it to the confirmed accounts named in `AUTH_PLATFORM_ADMIN_EMAILS`, in addition to
 * `parent`. Promoting further people later means a stored grant read by the provider; this table and
 * `decide` stay as they are.
 */
export const PLATFORM_ADMIN_ROLE = 'platform_admin';
export type Role = typeof PARENT_ROLE | typeof PLATFORM_ADMIN_ROLE;

/**
 * Code, not data, on purpose: it is versioned, reviewed, and cannot be changed by a request.
 * Move it to storage only when a real requirement for runtime-editable roles appears.
 */
const ROLE_PERMISSIONS = {
  parent: PERMISSIONS,
  platform_admin: PERMISSIONS,
} as const satisfies Record<Role, readonly Permission[]>;

/** Every permission a single role grants. Combining roles is `decide`'s job. */
export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
