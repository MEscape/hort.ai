import { PERMISSIONS } from './permission';

import type { Permission } from './permission';

/**
 * The one role of the first release: the parent or guardian who owns an account. Children are
 * profiles of a parent, not accounts, so there is no child role. A second role is added here
 * together with its row in `ROLE_PERMISSIONS`, which fails to compile until it has one.
 */
export const PARENT_ROLE = 'parent';
export type Role = typeof PARENT_ROLE;

/**
 * Code, not data, on purpose: it is versioned, reviewed, and cannot be changed by a request.
 * Move it to storage only when a real requirement for runtime-editable roles appears.
 */
const ROLE_PERMISSIONS = {
  parent: PERMISSIONS,
} as const satisfies Record<Role, readonly Permission[]>;

/** Every permission a single role grants. Combining roles is `decide`'s job. */
export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
