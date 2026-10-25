import type { AppResultAsync } from '@lib/result';

import type { ParentAreaDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';

/** Returning the device to the child revokes the parent proof immediately.
 * @audit-exempt Clears only the current session's temporary UI permission; no account or child data changes.
 */
export class CloseParentArea {
  constructor(private readonly deps: ParentAreaDependencies) {}
  execute(): AppResultAsync<void, AuthorizationError> {
    return this.deps.authorization
      .requireInTenant('learner.read')
      .andThen(() => this.deps.parentAccess.close());
  }
}
