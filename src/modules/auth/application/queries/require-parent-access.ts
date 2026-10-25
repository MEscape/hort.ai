import type { AppResultAsync } from '@lib/result';

import type { ParentAreaDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';

/** Parent permission is independent of merely holding the shared family session. */
export class RequireParentAccess {
  constructor(private readonly deps: ParentAreaDependencies) {}
  execute(): AppResultAsync<void, AuthorizationError> {
    return this.deps.authorization
      .requireInTenant('learner.read')
      .andThen(() => this.deps.parentAccess.require());
  }
}
