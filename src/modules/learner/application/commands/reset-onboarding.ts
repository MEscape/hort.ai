import type { AuthorizationError } from '@modules/auth';

import type { ForbiddenAppError, InfrastructureAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { devResetUnavailable } from '../../domain/errors/learner-errors';

import type { LearnerDependencies } from '../learner-dependencies';

export type ResetOnboardingError = AuthorizationError | ForbiddenAppError | InfrastructureAppError;

/**
 * DEVELOPMENT ONLY: deletes all of the signed-in parent's child profiles (finished or not) so the
 * setup can be run again. Authorizes first, then refuses where the reset is switched off
 * (production) without looking at any data, so the answer says nothing about what exists. Owner and
 * tenant come from the actor; another parent's profiles are never reached. Idempotent: with nothing
 * left it deletes 0 and records nothing. The audit event carries the count only.
 */
export class ResetOnboarding {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(): AppResultAsync<number, ResetOnboardingError> {
    const { authorization, childProfiles, audit, isDevResetAllowed } = this.deps;

    return authorization.requireInTenant('learner.delete').andThen((actor) => {
      if (!isDevResetAllowed) {
        return errAsync(devResetUnavailable());
      }
      return childProfiles
        .deleteAllOwned({ tenantId: actor.tenantId, ownerId: actor.id })
        .map((deletedCount) => {
          if (deletedCount > 0) {
            audit.record({
              type: 'learner.onboarding_reset',
              actorId: actor.id,
              tenantId: actor.tenantId,
              deletedCount,
            });
          }
          return deletedCount;
        });
    });
  }
}
