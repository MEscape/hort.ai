import type { ChildProfileView } from '@modules/learner';

import type { AppResultAsync } from '@lib/result';

import { childProfileNotFound } from '../../domain/errors/voice-errors';

import type {
  ChildVoiceConsent,
  ChildVoiceConsentError,
} from '../../domain/ports/child-voice-consent.port';

/** The learner module's `GetChildProfileById`: checks the parent's permission and ownership. */
type GetChildProfile = (id: string) => AppResultAsync<ChildProfileView, ChildVoiceConsentError>;

/**
 * Reads the consent from the child profile through the learner module's public query, which loads
 * the profile in the parent's tenant and checks it is theirs (`requireOnResource`). The learner
 * module answers a foreign profile with `forbidden` and a missing one with `not_found`; both become
 * the same `voice.child_profile_not_found` here, so the endpoint does not reveal which ids exist.
 */
export function learnerChildVoiceConsent(getChildProfile: GetChildProfile): ChildVoiceConsent {
  return {
    voiceConsentOf: (childProfileId) =>
      getChildProfile(childProfileId)
        .map((profile) => profile.voiceConsent)
        .mapErr((error) =>
          error.kind === 'forbidden' || error.kind === 'not_found' ? childProfileNotFound() : error,
        ),
  };
}
