import type { ChildProfileView } from '@modules/learner';

import type { AppResultAsync } from '@lib/result';

import type {
  ChildVoiceConsent,
  ChildVoiceConsentError,
} from '../../domain/ports/child-voice-consent.port';

/** The learner module's `GetChildProfileById`: checks the parent's permission and ownership. */
type GetChildProfile = (id: string) => AppResultAsync<ChildProfileView, ChildVoiceConsentError>;

/**
 * Reads the consent from the child profile through the learner module's public query, which loads
 * the profile in the parent's tenant and checks it is theirs (`requireOnResource`), so another
 * parent's child is refused there and never answered with `false`.
 */
export function learnerChildVoiceConsent(getChildProfile: GetChildProfile): ChildVoiceConsent {
  return {
    voiceConsentOf: (childProfileId) =>
      getChildProfile(childProfileId).map((profile) => profile.voiceConsent),
  };
}
