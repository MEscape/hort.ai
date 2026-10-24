import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createChildProfileDraft } from '../../domain/models/child-profile';
import { toChildProfileView } from '../learner-view-mappers';

import type { CreateChildProfileInput, ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';

/** Creates a child profile in the actor's own tenant. */
export class CreateChildProfile {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(
    input: CreateChildProfileInput,
  ): AppResultAsync<
    ChildProfileView,
    AuthorizationError | InfrastructureAppError | ValidationAppError
  > {
    const { authorization, childProfiles, audit } = this.deps;

    return authorization.requireInTenant('childprofile.create').andThen((actor) =>
      createChildProfileDraft(input)
        .asyncAndThen((draft) => childProfiles.create({ tenantId: actor.tenantId, draft }))
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
