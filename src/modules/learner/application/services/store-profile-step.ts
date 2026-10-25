import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { alreadyOnboarded } from '../../domain/errors/learner-errors';

import type { ChildProfile } from '../../domain/models/child-profile';
import type { ProfilePatch } from '../../domain/ports/child-profile.repository';
import type { LearnerDependencies } from '../learner-dependencies';

/** What a setup step stores, and the step it moves the setup forward to (at least). */
interface StepWrite {
  readonly profile: ChildProfile;
  readonly patch: ProfilePatch;
  readonly reaches: 'tutor' | 'controls' | 'review';
}

/**
 * Stores what a setup step chose and moves the step forward, never back. A profile that was
 * finished between the load and the write is `learner.already_onboarded`, like a finished one.
 */
export function storeProfileStep(
  { childProfiles }: LearnerDependencies,
  { profile, patch, reaches }: StepWrite,
): AppResultAsync<ChildProfile, ConflictAppError | InfrastructureAppError> {
  return childProfiles
    .updateUnfinished(profile, patch, reaches)
    .andThen((stored): AppResultAsync<ChildProfile, ConflictAppError> =>
      stored === null ? errAsync(alreadyOnboarded()) : okAsync(stored),
    );
}
