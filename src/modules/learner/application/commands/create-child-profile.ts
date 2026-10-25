import type { AuthorizationError } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { alreadyOnboarded } from '../../domain/errors/learner-errors';
import { createChildDetails } from '../../domain/models/child-profile';
import { onboardingStateOf } from '../../domain/models/onboarding-state';
import { OWN_PROFILES_LIMIT } from '../learner-limits';
import { toChildProfileView } from '../learner-view-mappers';

import type { SavedProfile } from '../../domain/ports/child-profile.repository';
import type { CreateChildProfileInput } from '../contracts/learner-inputs';
import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';

export type CreateChildProfileError =
  AuthorizationError | ValidationAppError | ConflictAppError | InfrastructureAppError;

/**
 * Saves the child's details for the signed-in parent. Idempotent by design: while the parent's
 * setup is unfinished, a repeated or corrected submit replaces the details of the one unfinished
 * profile instead of adding another; only the first one is audited. A parent whose child is already
 * set up gets `learner.already_onboarded` (further children are out of scope).
 */
export class CreateChildProfile {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(
    input: CreateChildProfileInput,
  ): AppResultAsync<ChildProfileView, CreateChildProfileError> {
    const { authorization, childProfiles, audit } = this.deps;

    return authorization.requireInTenant('learner.create').andThen((actor) =>
      createChildDetails(input).asyncAndThen((details) =>
        childProfiles
          .listByOwner(actor.id, actor.tenantId, OWN_PROFILES_LIMIT)
          .andThen((profiles): AppResultAsync<SavedProfile | null, CreateChildProfileError> =>
            onboardingStateOf(profiles).step === 'done'
              ? errAsync(alreadyOnboarded())
              : childProfiles.saveUnfinished({
                  tenantId: actor.tenantId,
                  ownerId: actor.id,
                  details,
                }),
          )
          // Finished by another request between the read and the write: the same answer.
          .andThen((saved): AppResultAsync<SavedProfile, ConflictAppError> =>
            saved === null ? errAsync(alreadyOnboarded()) : okAsync(saved),
          )
          .map(({ profile, isNew }) => {
            if (isNew) {
              audit.record({
                type: 'learner.profile_created',
                actorId: actor.id,
                tenantId: actor.tenantId,
                childProfileId: profile.id,
              });
            }
            return toChildProfileView(profile);
          }),
      ),
    );
  }
}
