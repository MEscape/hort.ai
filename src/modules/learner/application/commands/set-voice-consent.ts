import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { childProfileNotFound, voiceNoticeOutdated } from '../../domain/errors/learner-errors';
import { VOICE_NOTICE_VERSION } from '../../domain/models/parent-controls';
import { toChildProfileView } from '../learner-view-mappers';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';

import type { ChildProfile } from '../../domain/models/child-profile';
import type { VoiceConsentWrite } from '../../domain/ports/child-profile.repository';
import type { SetVoiceConsentInput } from '../contracts/learner-inputs';
import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

export type SetVoiceConsentError =
  LoadChildProfileError | ConflictAppError | InfrastructureAppError;

/**
 * The parent allows or withdraws speech-to-text for their own child, during or after the setup
 * (#34). Allowing needs the voice notice version the parent read to be the current one, else
 * `learner.voice_notice_outdated` and nothing is stored; it records the confirmation time from the
 * clock. Withdrawing switches the voice control off and clears the confirmation, so the voice
 * module refuses the next recording at once. Another parent's child answers like an unknown id.
 * Audited with the decision and the notice version only.
 */
export class SetVoiceConsent {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(input: SetVoiceConsentInput): AppResultAsync<ChildProfileView, SetVoiceConsentError> {
    const { childProfiles, audit, clock } = this.deps;

    return loadAuthorizedChildProfile(this.deps, input.profileId, 'learner.update').andThen(
      ({ actor, childProfile }) => {
        if (input.allowed && input.noticeVersion !== VOICE_NOTICE_VERSION) {
          return errAsync(voiceNoticeOutdated());
        }
        const consent: VoiceConsentWrite = input.allowed
          ? {
              voiceEnabled: true,
              voiceNotice: { confirmedAt: clock.now(), version: VOICE_NOTICE_VERSION },
            }
          : { voiceEnabled: false, voiceNotice: null };
        return childProfiles
          .updateVoiceConsent(childProfile, consent)
          .andThen((stored): AppResultAsync<ChildProfile, SetVoiceConsentError> =>
            stored === null ? errAsync(childProfileNotFound()) : okAsync(stored),
          )
          .map((stored) => {
            audit.record({
              type: 'learner.voice_consent_changed',
              actorId: actor.id,
              tenantId: actor.tenantId,
              childProfileId: stored.id,
              allowed: input.allowed,
              noticeVersion: consent.voiceNotice?.version ?? null,
            });
            return toChildProfileView(stored);
          });
      },
    );
  }
}
