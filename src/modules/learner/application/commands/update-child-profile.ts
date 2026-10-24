import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { definedKeys } from '@lib/utils';

import { isEmptyChanges, parseChildProfileChanges } from '../../domain/models/child-profile';
import { toChildProfileView } from '../learner-view-mappers';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';

import type { ChildProfile } from '../../domain/models/child-profile';
import type { ChildProfileView, UpdateChildProfileInput } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

/** Applies a partial update to one child profile; an empty update changes nothing. */
export class UpdateChildProfile {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(input: UpdateChildProfileInput): AppResultAsync<ChildProfileView, LoadChildProfileError> {
    const { childProfiles, audit } = this.deps;

    return loadAuthorizedChildProfile(this.deps, input.id, 'learner.update').andThen(
      ({ actor, childProfile }) =>
        parseChildProfileChanges(input)
          .asyncAndThen(
            (changes): AppResultAsync<ChildProfile, NotFoundAppError | InfrastructureAppError> => {
              if (isEmptyChanges(changes)) {
                return okAsync(childProfile);
              }
              return childProfiles
                .update(childProfile.id, actor.tenantId, changes)
                .map((updated) => {
                  audit.record({
                    type: 'child_profile.updated',
                    actorId: actor.id,
                    tenantId: actor.tenantId,
                    childProfileId: updated.id,
                    changedFields: definedKeys(changes),
                  });
                  return updated;
                });
            },
          )
          .map(toChildProfileView),
    );
  }
}
