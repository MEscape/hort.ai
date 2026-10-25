import type { Actor } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { childProfileNotFound, setupIncomplete } from '../../domain/errors/learner-errors';
import {
  isSetupComplete,
  isWelcomeComplete,
  withWelcomeCompleted,
} from '../../domain/models/child-profile';
import { toChildProfileView } from '../learner-view-mappers';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';

import type { ChildProfile } from '../../domain/models/child-profile';
import type { CompleteChildWelcomeInput } from '../contracts/learner-inputs';
import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

export type CompleteChildWelcomeError = LoadChildProfileError | ConflictAppError;

type Finished = AppResultAsync<
  ChildProfile,
  NotFoundAppError | ConflictAppError | InfrastructureAppError
>;

/**
 * Finishes the child's welcome once the parent's setup is done; before that it answers
 * `learner.setup_incomplete`. A companion is not required (the parent may have skipped it).
 * Idempotent: a finished welcome returns the stored view and writes and audits nothing, so only the
 * call that wins the conditional write is audited.
 */
export class CompleteChildWelcome {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(
    input: CompleteChildWelcomeInput,
  ): AppResultAsync<ChildProfileView, CompleteChildWelcomeError> {
    return loadAuthorizedChildProfile(this.deps, input.profileId, 'learner.update')
      .andThen(({ actor, childProfile }): Finished => {
        if (!isSetupComplete(childProfile)) {
          return errAsync(setupIncomplete());
        }
        return isWelcomeComplete(childProfile)
          ? okAsync(childProfile)
          : this.finish(actor, childProfile);
      })
      .map(toChildProfileView);
  }

  private finish(actor: Actor, profile: ChildProfile): Finished {
    const { childProfiles, audit, clock } = this.deps;
    const completedAt = clock.now();

    return childProfiles
      .markWelcomeCompleted(profile, completedAt)
      .andThen((isWinner): Finished => {
        if (!isWinner) {
          // Another request finished it first: answer with what it stored, record nothing.
          return childProfiles
            .findOwned(profile.id, profile.ownerId, profile.tenantId)
            .andThen((stored): Finished => {
              if (stored === null) {
                return errAsync(childProfileNotFound());
              }
              return isWelcomeComplete(stored) ? okAsync(stored) : errAsync(setupIncomplete());
            });
        }
        audit.record({
          type: 'learner.child_welcome_completed',
          actorId: actor.id,
          tenantId: actor.tenantId,
          childProfileId: profile.id,
        });
        return okAsync(withWelcomeCompleted(profile, completedAt));
      });
  }
}
