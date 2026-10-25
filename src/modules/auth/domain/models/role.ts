import { literalGuard } from '@lib/utils';

import {
  ACCOUNT_PERMISSIONS,
  GUIDANCE_PERMISSIONS,
  LEARNER_PERMISSIONS,
  PERMISSIONS,
  TEACHER_PERMISSIONS,
} from './permission';

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
export type StoredRole = (typeof ROLES)[number];

/** Whether a stored or submitted value is one of the roles; anything else is refused. */
export const isRole = literalGuard(ROLES);

/**
 * Operates the platform: holds every permission on any parent's resources of its own tenant (`decide`
 * skips the owner comparison for it, and the authorization service audits each such access). The
 * provider grants it to the confirmed accounts named in `AUTH_PLATFORM_ADMIN_EMAILS`, in addition to
 * `parent`. Promoting further people later means a stored grant read by the provider; this table and
 * `decide` stay as they are.
 */
export const PLATFORM_ADMIN_ROLE = 'platform_admin';

/**
 * A voice channel acting for ONE child of its guardian (the Alexa demo coupling): the child-side reads
 * and the daily reward, nothing a parent decides (settings, consent, onboarding, voice, hints) and
 * nothing of a teacher. Never stored and never given by sign-in: only the channel scope in
 * infrastructure/channel grants it, for the duration of one server-verified channel request.
 */
export const CHILD_CHANNEL_ROLE = 'child_channel';

/** Every role an actor can hold: the stored ones plus the roles the server grants itself. */
export type Role = StoredRole | typeof PLATFORM_ADMIN_ROLE | typeof CHILD_CHANNEL_ROLE;

/**
 * Code, not data, on purpose: it is versioned, reviewed, and cannot be changed by a request.
 * The grants are disjoint: a teacher holds no `learner.*`, a parent no `classroom.*`.
 * Move it to storage only when a real requirement for runtime-editable roles appears.
 */
const ROLE_PERMISSIONS = {
  parent: [...LEARNER_PERMISSIONS, ...GUIDANCE_PERMISSIONS, ...ACCOUNT_PERMISSIONS],
  teacher: [...TEACHER_PERMISSIONS, ...ACCOUNT_PERMISSIONS],
  platform_admin: PERMISSIONS,
  child_channel: ['learner.read', 'progression.read', 'progression.update'],
} as const satisfies Record<Role, readonly Permission[]>;

/** Every permission a single role grants. Combining roles is `decide`'s job. */
export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
