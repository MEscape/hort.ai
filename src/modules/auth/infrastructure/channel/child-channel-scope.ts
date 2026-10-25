import { AsyncLocalStorage } from 'node:async_hooks';

import { okAsync } from '@lib/result';

import { toActorId } from '../../domain/models/ids';
import { CHILD_CHANNEL_ROLE } from '../../domain/models/role';

import type { Actor } from '../../domain/models/actor';
import type { TenantId } from '../../domain/models/ids';
import type { CurrentActorProvider } from '../../domain/ports/current-actor-provider.port';

/** Who a channel acts for: the guardian who owns the one child profile the channel is bound to. */
export interface ChildChannelBinding {
  readonly guardianId: string;
  readonly tenantId: TenantId;
}

const scope = new AsyncLocalStorage<Actor>();

/**
 * The actor of a server-verified channel request (Alexa: Amazon's signature plus the skill id) that is
 * bound to one child by server configuration. It carries the guardian's id, so every use case still
 * checks ownership as for the guardian, but only `CHILD_CHANNEL_ROLE`: a parent operation is denied by
 * the same `decide` as any missing permission. The scope ends with `work`; a request outside it, every
 * web request included, keeps resolving its actor from its own session.
 */
export function runInChildChannel<T>(
  binding: ChildChannelBinding,
  work: () => Promise<T>,
): Promise<T> {
  const actor: Actor = {
    id: toActorId(binding.guardianId),
    tenantId: binding.tenantId,
    roles: [CHILD_CHANNEL_ROLE],
  };
  return scope.run(actor, work);
}

/** Resolves the channel actor inside `runInChildChannel`, else asks `session` (the request's sign-in). */
export function withChildChannelScope(session: CurrentActorProvider): CurrentActorProvider {
  return {
    getCurrentActor: () => {
      const channelActor = scope.getStore();
      return channelActor ? okAsync(channelActor) : session.getCurrentActor();
    },
  };
}
