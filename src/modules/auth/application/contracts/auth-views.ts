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
