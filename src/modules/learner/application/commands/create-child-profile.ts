import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createChildProfileDraft } from '../../domain/models/child-profile';
import { toChildProfileView } from '../learner-view-mappers';

import type { CreateChildProfileInput, ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';

/** Creates a child profile owned by the signed-in parent (the authorized actor is the owner). */
export class CreateChildProfile {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(
    input: CreateChildProfileInput,
  ): AppResultAsync<
    ChildProfileView,
    AuthorizationError | InfrastructureAppError | ValidationAppError
  > {
    const { authorization, childProfiles, audit } = this.deps;

    return authorization.requireInTenant('learner.create').andThen((actor) =>
      createChildProfileDraft(input)
        .asyncAndThen((draft) => childProfiles.create({ tenantId: actor.tenantId, ownerId: actor.id, draft }))
        .map((childProfile) => {
          audit.record({
            type: 'child_profile.created',
            actorId: actor.id,
            tenantId: actor.tenantId,
            childProfileId: childProfile.id,
          });
          return toChildProfileView(childProfile);
        }),
    );
  }
}
