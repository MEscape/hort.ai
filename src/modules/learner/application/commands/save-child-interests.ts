import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createInterests, sameInterests } from '../../domain/models/interests';
import { toChildProfileView } from '../learner-view-mappers';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';
import { requirePendingWelcome } from '../services/require-pending-welcome';
import { storeWelcomeChoice } from '../services/store-welcome-choice';

import type { SaveChildInterestsInput } from '../contracts/learner-inputs';
import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

export type SaveChildInterestsError =
  LoadChildProfileError | ConflictAppError | ValidationAppError | InfrastructureAppError;

/**
 * The child's own change of the interests during the welcome (same closed list and limits as the
 * parent's step). Changes only the interests; the parent's setup step stays as it is. Idempotent:
 * the same set again is not audited again, and the event carries the count, never the values.
 */
export class SaveChildInterests {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(
    input: SaveChildInterestsInput,
  ): AppResultAsync<ChildProfileView, SaveChildInterestsError> {
    const { audit } = this.deps;

    return loadAuthorizedChildProfile(this.deps, input.profileId, 'learner.update')
      .andThen(requirePendingWelcome)
      .andThen(({ actor, childProfile }) =>
        createInterests(input.interests).asyncAndThen((interests) =>
          storeWelcomeChoice(this.deps, childProfile, { interests }).map((stored) => {
            if (!sameInterests(childProfile.interests, interests)) {
              audit.record({
                type: 'learner.child_interests_saved',
                actorId: actor.id,
                tenantId: actor.tenantId,
                childProfileId: stored.id,
                count: interests.length,
              });
            }
            return toChildProfileView(stored);
          }),
        ),
      );
  }
}
