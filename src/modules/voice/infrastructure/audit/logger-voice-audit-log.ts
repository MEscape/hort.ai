import { createAuditLog } from '@lib/logger';

import type { VoiceAuditLog, VoiceEvent } from '../../domain/ports/voice-audit-log.port';

/** Consent changes are ordinary, expected events. */
export const LEVEL_BY_EVENT = {
  'voice.consent_granted': 'info',
  'voice.consent_revoked': 'info',
} as const satisfies Record<VoiceEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `voice.audit`; never throws. */
export const loggerVoiceAuditLog: VoiceAuditLog = createAuditLog('voice.audit', LEVEL_BY_EVENT);
