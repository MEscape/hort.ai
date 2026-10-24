import type { Actor } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { childProfileNotFound, setupIncomplete } from '../../domain/errors/learner-errors';
import { isSetupComplete, withSetupCompleted } from '../../domain/models/child-profile';
import { toChildProfileView } from '../learner-view-mappers';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';

import type { ChildProfile } from '../../domain/models/child-profile';
import type { CompleteSetupInput } from '../contracts/learner-inputs';
import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

export type CompleteSetupError = LoadChildProfileError | ConflictAppError;

type Finished = AppResultAsync<
  ChildProfile,
  NotFoundAppError | ConflictAppError | InfrastructureAppError
>;

/**
 * Finishes the child's setup once the parent has reached the review step; before that it answers
 * `learner.setup_incomplete`. Idempotent: for a profile that is already set up it returns the stored
 * view and writes and audits nothing, so a repeated or concurrent call changes nothing (only the
 * call that wins the conditional write is audited). Another parent's profile id answers exactly like
 * an unknown one.
 */
export class CompleteSetup {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(input: CompleteSetupInput): AppResultAsync<ChildProfileView, CompleteSetupError> {
    return loadAuthorizedChildProfile(this.deps, input.profileId, 'learner.update')
      .andThen(({ actor, childProfile }): Finished => {
        if (isSetupComplete(childProfile)) {
          return okAsync(childProfile);
        }
        return childProfile.setupStep === 'review'
          ? this.finish(actor, childProfile)
          : errAsync(setupIncomplete());
      })
      .map(toChildProfileView);
  }

  private finish(actor: Actor, profile: ChildProfile): Finished {
    const { childProfiles, audit, clock } = this.deps;
    const completedAt = clock.now();

    return childProfiles.markSetupCompleted(profile, completedAt).andThen((isWinner): Finished => {
      if (!isWinner) {
        // Another request finished it first: answer with what it stored, record nothing.
        return childProfiles
          .findOwned(profile.id, profile.ownerId, profile.tenantId)
          .andThen((stored): Finished => {
            if (stored === null) {
              return errAsync(childProfileNotFound());
            }
            return isSetupComplete(stored) ? okAsync(stored) : errAsync(setupIncomplete());
          });
      }
      audit.record({
        type: 'learner.setup_completed',
        actorId: actor.id,
        tenantId: actor.tenantId,
        childProfileId: profile.id,
      });
      return okAsync(withSetupCompleted(profile, completedAt));
    });
  }
}
