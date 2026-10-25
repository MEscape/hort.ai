import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createInterests, sameInterests } from '../../domain/models/interests';
import { toChildProfileView } from '../learner-view-mappers';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';
import { requireUnfinishedProfile } from '../services/require-unfinished-profile';
import { storeProfileStep } from '../services/store-profile-step';

import type { SaveInterestsInput } from '../contracts/learner-inputs';
import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

export type SaveInterestsError =
  LoadChildProfileError | ConflictAppError | ValidationAppError | InfrastructureAppError;

/**
 * Stores what the child likes (zero to four values of a closed list; skipping is valid) and
 * advances the setup to at least the companion step. Idempotent: saving the same set again is
 * allowed and is not audited again, and the audit event carries the count, never the values.
 */
export class SaveInterests {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(input: SaveInterestsInput): AppResultAsync<ChildProfileView, SaveInterestsError> {
    const { audit } = this.deps;

    return loadAuthorizedChildProfile(this.deps, input.profileId, 'learner.update')
      .andThen(requireUnfinishedProfile)
      .andThen(({ actor, childProfile }) =>
        createInterests(input.interests).asyncAndThen((interests) =>
          storeProfileStep(this.deps, {
            profile: childProfile,
            patch: { interests },
            reaches: 'tutor',
          }).map((stored) => {
            if (!sameInterests(childProfile.interests, interests)) {
              audit.record({
                type: 'learner.interests_saved',
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
