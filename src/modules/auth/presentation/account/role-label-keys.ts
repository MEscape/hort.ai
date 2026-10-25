import type { Role } from '../../application/contracts/auth-views';

/** Each role's label key, written out so every key is checked and none is built at runtime. */
export const ROLE_LABEL_KEYS = {
  parent: 'account.roles.parent',
  teacher: 'account.roles.teacher',
  platform_admin: 'account.roles.platform_admin',
} as const satisfies Record<Role, string>;
