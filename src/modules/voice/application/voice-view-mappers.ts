import { isConsentGiven } from '../domain/models/voice-consent';

import type { VoiceConsentView } from './contracts/voice-views';
import type { VoiceConsent } from '../domain/models/voice-consent';

export function toVoiceConsentView(consent: VoiceConsent | null): VoiceConsentView {
  return {
    given: isConsentGiven(consent),
    grantedAt: consent?.grantedAt.toISOString() ?? null,
    revokedAt: consent?.revokedAt?.toISOString() ?? null,
  };
}
