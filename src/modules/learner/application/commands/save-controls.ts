import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { confirmGuardian } from '../../domain/models/child-profile';
import { changedControls, createParentControls } from '../../domain/models/parent-controls';
import { toChildProfileView } from '../learner-view-mappers';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';
import { requireUnfinishedProfile } from '../services/require-unfinished-profile';
import { storeProfileStep } from '../services/store-profile-step';

import type { SaveControlsInput } from '../contracts/learner-inputs';
import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

export type SaveControlsError =
  LoadChildProfileError | ConflictAppError | ValidationAppError | InfrastructureAppError;

/**
 * Stores the parent controls together with the guardian's confirmation and advances the setup to at
 * least the review step. The confirmation is required (`guardianConfirmed: true`); its time comes
 * from the clock and is kept on a re-save while the statement version is unchanged. Audited: which
 * controls changed (flags only) and, once per confirmation, the statement version.
 */
export class SaveControls {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(input: SaveControlsInput): AppResultAsync<ChildProfileView, SaveControlsError> {
    const { audit, clock } = this.deps;

    return loadAuthorizedChildProfile(this.deps, input.profileId, 'learner.update')
      .andThen(requireUnfinishedProfile)
      .andThen(({ actor, childProfile }) =>
        createParentControls(input).asyncAndThen((controls) => {
          const guardian = confirmGuardian(childProfile.guardian, clock.now());
          return storeProfileStep(this.deps, {
            profile: childProfile,
            patch: { controls, guardian },
            reaches: 'review',
          }).map((stored) => {
            const ids = {
              actorId: actor.id,
              tenantId: actor.tenantId,
              childProfileId: stored.id,
            };
            const change = changedControls(childProfile.controls, controls);
            if (change !== null) {
              audit.record({ type: 'learner.controls_changed', ...ids, ...change });
            }
            if (guardian !== childProfile.guardian) {
              audit.record({
                type: 'learner.guardian_consent_recorded',
                ...ids,
                consentVersion: guardian.consentVersion,
              });
            }
            return toChildProfileView(stored);
          });
        }),
      );
  }
}
