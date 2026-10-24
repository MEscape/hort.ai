import type { ActorView } from './contracts/auth-views';
import type { Actor } from '../domain/models/actor';

export function toActorView(actor: Actor): ActorView {
  return { id: actor.id, tenantId: actor.tenantId, roles: actor.roles };
}
