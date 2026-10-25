import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { voiceNoticeOutdated } from '../../domain/errors/learner-errors';
import {
  confirmGuardian,
  confirmVoiceNotice,
  hasCurrentVoiceConsent,
} from '../../domain/models/child-profile';
import {
  VOICE_NOTICE_VERSION,
  changedControls,
  createParentControls,
} from '../../domain/models/parent-controls';
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
 * from the clock and is kept on a re-save while the statement version is unchanged. Voice on is the
 * same decision as the voice switch on the home (#98): switching it on in this form sends the current
 * voice notice version and records its confirmation; voice on without a version keeps the stored
 * decision (an older open form cannot restore a withdrawn consent); voice off clears it; an outdated
 * version stores nothing. Audited:
 * which controls changed (flags only), once per confirmation the statement version, and a changed
 * voice decision with its notice version.
 */
export class SaveControls {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(input: SaveControlsInput): AppResultAsync<ChildProfileView, SaveControlsError> {
    const { audit, clock } = this.deps;

    return loadAuthorizedChildProfile(this.deps, input.profileId, 'learner.update')
      .andThen(requireUnfinishedProfile)
      .andThen(({ actor, childProfile }): AppResultAsync<ChildProfileView, SaveControlsError> => {
        // Only an explicit opt-in in this form carries a notice version. Voice on without one is
        // "unchanged": it keeps the stored decision, so an older open form cannot restore a consent
        // that was withdrawn meanwhile (#98). An outdated version is refused.
        const optIn = input.voiceNoticeVersion !== null;
        if (input.voiceEnabled && optIn && input.voiceNoticeVersion !== VOICE_NOTICE_VERSION) {
          return errAsync(voiceNoticeOutdated());
        }
        const voiceEnabled = input.voiceEnabled && (optIn || hasCurrentVoiceConsent(childProfile));
        return createParentControls({ ...input, voiceEnabled }).asyncAndThen((controls) => {
          const now = clock.now();
          const guardian = confirmGuardian(childProfile.guardian, now);
          const voiceNotice = confirmVoiceNotice(
            childProfile.voiceNotice,
            controls.voiceEnabled,
            now,
          );
          return storeProfileStep(this.deps, {
            profile: childProfile,
            patch: { controls, guardian, voiceNotice },
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
            if (voiceNotice !== childProfile.voiceNotice) {
              audit.record({
                type: 'learner.voice_consent_changed',
                ...ids,
                allowed: voiceNotice !== null,
                noticeVersion: voiceNotice?.version ?? null,
              });
            }
            return toChildProfileView(stored);
          });
        });
      });
  }
}
