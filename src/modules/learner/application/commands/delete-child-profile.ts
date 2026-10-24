import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';

import type { DeleteChildProfileInput } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

/** Deletes one child profile. Deleting one that is already gone is a "not found", not a silent success. */
export class DeleteChildProfile {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(input: DeleteChildProfileInput): AppResultAsync<void, LoadChildProfileError> {
    const { childProfiles, audit } = this.deps;

    return loadAuthorizedChildProfile(this.deps, input.id, 'learner.delete').andThen(
      ({ actor, childProfile }) =>
        childProfiles.deleteById(childProfile.id, actor.tenantId, actor.id).map(() => {
          audit.record({
            type: 'child_profile.deleted',
            actorId: actor.id,
            tenantId: actor.tenantId,
            childProfileId: childProfile.id,
          });
        }),
    );
  }
}
