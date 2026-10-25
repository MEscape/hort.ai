import type { Role } from '../../domain/models/role';

export type { Role };

/**
 * The signed-in parent as consumers see it: plain and serializable. Meant
 * for server-side guards and rendering; the tenant is an internal detail
 * and must not be echoed to the browser.
 */
export interface ActorView {
  readonly id: string;
  readonly tenantId: string;
  readonly roles: readonly Role[];
}

/** The signed-in person's own account for the header and the settings page. No ids, no secrets. */
export interface AccountView {
  readonly name: string;
  readonly email: string;
  /** Read-only: chosen once at registration. */
  readonly role: Role;
}
