import type { Actor } from '@modules/auth';

import type { AppResultAsync } from '@lib/result';

import type { ChildProfileId } from '../../domain/models/ids';
import type {
  ChildProfileAccessError,
  OwnChildProfile,
} from '../../domain/ports/child-profile-access.port';
import type { HelpSessionOwner } from '../../domain/ports/help-session.repository';
import type { HelpSessionDependencies } from '../help-session-dependencies';

/**
 * The owner scope of a help session: the signed-in parent, once the learner module confirmed the
 * child is theirs. Another parent's child is "not found" before any session is read.
 */
export function ownChildScope(
  deps: HelpSessionDependencies,
  actor: Actor,
  childProfileId: ChildProfileId,
): AppResultAsync<
  {
    readonly owner: HelpSessionOwner;
    readonly childProfileId: ChildProfileId;
    readonly child: OwnChildProfile;
  },
  ChildProfileAccessError
> {
  return deps.childProfiles.findOwn(childProfileId).map((child) => ({
    owner: { tenantId: actor.tenantId, ownerId: actor.id },
    childProfileId: child.id,
    child,
  }));
}
