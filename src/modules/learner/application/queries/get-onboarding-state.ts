import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { onboardingStateOf } from '../../domain/models/onboarding-state';
import { OWN_PROFILES_LIMIT } from '../learner-limits';
import { toOnboardingStateView } from '../learner-view-mappers';

import type { OnboardingStateView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';

export type GetOnboardingStateError = AuthorizationError | InfrastructureAppError;

/** Where the signed-in parent stands in the child setup. Looks only at their own profiles. */
export class GetOnboardingState {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(): AppResultAsync<OnboardingStateView, GetOnboardingStateError> {
    const { authorization, childProfiles } = this.deps;

    return authorization
      .requireInTenant('learner.read')
      .andThen((actor) => childProfiles.listByOwner(actor.id, actor.tenantId, OWN_PROFILES_LIMIT))
      .map((profiles) => toOnboardingStateView(onboardingStateOf(profiles)));
  }
}
