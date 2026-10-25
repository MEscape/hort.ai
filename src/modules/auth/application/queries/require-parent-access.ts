import type { AppResultAsync } from '@lib/result';

import type { ParentAreaDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';

/**
 * Parent permission is independent of merely holding the shared family session. `learner.list` is a
 * parent's alone, so a channel bound to one child (Alexa) never passes the gate of the adult reads.
 */
export class RequireParentAccess {
  constructor(private readonly deps: ParentAreaDependencies) {}
  execute(): AppResultAsync<void, AuthorizationError> {
    return this.deps.authorization
      .requireInTenant('learner.list')
      .andThen(() => this.deps.parentAccess.require());
  }
}
