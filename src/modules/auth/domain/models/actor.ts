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
  /**
   * Set only for a server-verified channel (Alexa) that acts FOR the guardian `id`, bound to one child
   * by server configuration: `decide` lets it touch that child's resources only, and audit events name
   * the channel as the acting party with the guardian as the one it acts for, never the guardian alone.
   */
  readonly delegation?: ChannelDelegation;
}

export interface ChannelDelegation {
  /** Which channel acts (`alexa`); an id of the channel, never of a device or an Amazon account. */
  readonly channel: string;
  /** The one child profile the channel may touch. */
  readonly childProfileId: string;
}

/**
 * Who an audit event names as acting: the signed-in member (`actorId`), or a channel acting on behalf
 * of its guardian. A channel event carries no `actorId`, so the trail never shows it as the guardian.
 */
export type AuditedActor =
  { readonly actorId: ActorId } | { readonly channel: string; readonly onBehalfOf: ActorId };

export function auditedActor(actor: Actor): AuditedActor {
  const { delegation } = actor;
  return delegation ? { channel: delegation.channel, onBehalfOf: actor.id } : { actorId: actor.id };
}
