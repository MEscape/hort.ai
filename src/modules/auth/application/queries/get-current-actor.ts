import type { AppResultAsync } from '@lib/result';

import { toActorView } from '../actor-view-mappers';

import type { CurrentActorError } from '../../domain/ports/current-actor-provider.port';
import type { CurrentActorDependencies } from '../auth-dependencies';
import type { ActorView } from '../contracts/auth-views';

/**
 * Who is signed in, for server-side guards and rendering. Reading this is
 * not authorization: a page that shows or hides something on it must
 * still be backed by a use case that calls `AuthorizationService`.
 *
 * @authorization public Answers who the caller is; an anonymous caller learns only that it is anonymous.
 * @rate-limit none A session lookup that runs on every request that renders a signed-in page; limiting it would break navigation, and it reveals nothing about anyone else.
 */
export class GetCurrentActor {
  constructor(private readonly deps: CurrentActorDependencies) {}

  execute(): AppResultAsync<ActorView, CurrentActorError> {
    return this.deps.currentActor.getCurrentActor().map(toActorView);
  }
}
