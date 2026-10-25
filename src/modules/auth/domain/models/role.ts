import { literalGuard } from '@lib/utils';

import { GUIDANCE_PERMISSIONS, LEARNER_PERMISSIONS, TEACHER_PERMISSIONS } from './permission';

import type { Permission } from './permission';

/**
 * The roles of the MVP. A parent or guardian owns child profiles; a teacher owns classes, their
 * material and their assignments. Children are profiles of a parent, not accounts, so there is no
 * child role. A role is chosen once, at registration, and stored with the account; no later
 * request changes it. A teacher is not verified in the MVP (a documented risk, see
 * docs/architecture/authentication.md). A new role is added here together with its row in
 * `ROLE_PERMISSIONS`, which fails to compile until it has one.
 */
export const PARENT_ROLE = 'parent';
export const TEACHER_ROLE = 'teacher';
export const ROLES = [PARENT_ROLE, TEACHER_ROLE] as const;
export type Role = (typeof ROLES)[number];

/** Whether a stored or submitted value is one of the roles; anything else is refused. */
export const isRole = literalGuard(ROLES);

/**
 * Code, not data, on purpose: it is versioned, reviewed, and cannot be changed by a request.
 * The grants are disjoint: a teacher holds no `learner.*`, a parent no `classroom.*`.
 * Move it to storage only when a real requirement for runtime-editable roles appears.
 */
const ROLE_PERMISSIONS = {
  parent: [...LEARNER_PERMISSIONS, ...GUIDANCE_PERMISSIONS],
  teacher: TEACHER_PERMISSIONS,
} as const satisfies Record<Role, readonly Permission[]>;

/** Every permission a single role grants. Combining roles is `decide`'s job. */
export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
