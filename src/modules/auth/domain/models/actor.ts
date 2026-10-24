import type { ActorId, TenantId } from './ids';
import type { Role } from './role';

/**
 * Who is acting, and in what capacity within one tenant. Nothing here comes
 * from an authentication library: a provider session type in this file
 * would tie the whole application to that provider.
 *
 * The actor is the signed-in PARENT. A learner (child profile) the parent is working with is a
 * different identity that the learner module resolves and checks against `id`; it is never an
 * actor and has no permissions of its own.
 */
export interface Actor {
  readonly id: ActorId;
  readonly tenantId: TenantId;
  readonly roles: readonly Role[];
}
