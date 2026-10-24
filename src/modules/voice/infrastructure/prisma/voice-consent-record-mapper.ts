import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';

import type { VoiceConsent } from '../../domain/models/voice-consent';

/** The columns the module reads, and nothing else, so no generated database type leaves this layer. */
export interface VoiceConsentRecord {
  readonly grantedAt: InstantRecord;
  readonly revokedAt: InstantRecord | null;
}

export const VOICE_CONSENT_SELECT = ['grantedAt', 'revokedAt'] as const;

export function toVoiceConsent(record: VoiceConsentRecord): VoiceConsent {
  return {
    grantedAt: instantToDate(record.grantedAt),
    revokedAt: record.revokedAt === null ? null : instantToDate(record.revokedAt),
  };
}
