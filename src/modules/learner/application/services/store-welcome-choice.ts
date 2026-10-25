import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { welcomeAlreadyCompleted } from '../../domain/errors/learner-errors';

import type { ChildProfile } from '../../domain/models/child-profile';
import type { WelcomePatch } from '../../domain/ports/child-profile.repository';
import type { LearnerDependencies } from '../learner-dependencies';

/**
 * Stores what the child chose during the welcome. A welcome finished between the load and the
 * write is `learner.welcome_already_completed`, like a finished one.
 */
export function storeWelcomeChoice(
  { childProfiles }: LearnerDependencies,
  profile: ChildProfile,
  patch: WelcomePatch,
): AppResultAsync<ChildProfile, ConflictAppError | InfrastructureAppError> {
  return childProfiles
    .updateWelcomePending(profile, patch)
    .andThen((stored): AppResultAsync<ChildProfile, ConflictAppError> =>
      stored === null ? errAsync(welcomeAlreadyCompleted()) : okAsync(stored),
    );
}
