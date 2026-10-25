import type { ConflictAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { errAsync, okAsync } from '@lib/result';

import { childProfileNotFound, setupIncomplete } from '../../domain/errors/learner-errors';
import { changedControls, createParentControls } from '../../domain/models/parent-controls';
import { toChildProfileView } from '../learner-view-mappers';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';

import type { ChildProfile } from '../../domain/models/child-profile';
import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

export interface UpdateParentControlsInput {
  readonly profileId: string;
  readonly dailyLimitMinutes: number | null;
  readonly allowedWindow: { readonly fromMinute: number; readonly untilMinute: number } | null;
  readonly learningInsights: boolean;
}

/** Updates only adult settings; voice consent has its own reviewed notice and command. */
export class UpdateParentControls {
  constructor(private readonly deps: LearnerDependencies) {}
  execute(
    input: UpdateParentControlsInput,
  ): AppResultAsync<ChildProfileView, LoadChildProfileError | ConflictAppError> {
    return loadAuthorizedChildProfile(this.deps, input.profileId, 'learner.update').andThen(
      ({ actor, childProfile }) => {
        if (childProfile.setupCompletedAt === null) {
          return errAsync(setupIncomplete());
        }
        return createParentControls({
          ...input,
          voiceEnabled: childProfile.controls.voiceEnabled,
          guardianConfirmed: true,
        }).asyncAndThen((controls) =>
          this.deps.childProfiles
            .updateParentControls(childProfile, controls)
            .andThen((stored): AppResultAsync<ChildProfile, LoadChildProfileError> =>
              stored === null ? errAsync(childProfileNotFound()) : okAsync(stored),
            )
            .map((stored) => {
              const change = changedControls(childProfile.controls, stored.controls);
              if (change) {
                this.deps.audit.record({
                  type: 'learner.controls_changed',
                  actorId: actor.id,
                  tenantId: actor.tenantId,
                  childProfileId: stored.id,
                  ...change,
                });
              }
              return toChildProfileView(stored);
            }),
        );
      },
    );
  }
}
