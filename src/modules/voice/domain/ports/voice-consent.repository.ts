import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { VoiceConsent, VoiceConsentHolder } from '../models/voice-consent';

/** Where parents' speech consent is kept. A failure is never read as consent. */
export interface VoiceConsentRepository {
  /** The holder's consent record, or `null` when they never granted it. */
  find(holder: VoiceConsentHolder): AppResultAsync<VoiceConsent | null, InfrastructureAppError>;
  /** Grants (again) at `at`, clearing an earlier revocation. */
  grant(holder: VoiceConsentHolder, at: Date): AppResultAsync<VoiceConsent, InfrastructureAppError>;
  /** Revokes at `at`; `null` when there was nothing to revoke. An existing revocation is kept. */
  revoke(
    holder: VoiceConsentHolder,
    at: Date,
  ): AppResultAsync<VoiceConsent | null, InfrastructureAppError>;
}
