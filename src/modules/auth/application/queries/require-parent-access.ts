import type { AppResultAsync } from '@lib/result';

import type { ParentAreaDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';

/**
 * Parent permission is independent of merely holding the shared family session. The proof itself is
 * "re-entered the account password", which any account may give (`account.read`): it grants no
 * data by itself, since every child read still checks `learner.*` on the stored profile.
 * A channel bound to one child (Alexa) has no `account.read`, so it never passes the gate either.
 */
export class RequireParentAccess {
  constructor(private readonly deps: ParentAreaDependencies) {}
  execute(): AppResultAsync<void, AuthorizationError> {
    return this.deps.authorization
      .requireInTenant('account.read')
      .andThen(() => this.deps.parentAccess.require());
  }
}
