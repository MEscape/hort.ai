import type { AuthorizationService } from '@modules/auth';

import type { Clock } from '@lib/clock';
import type { RateLimiter } from '@lib/rate-limit';
import type { SpeechProvider } from '@lib/speech';

import type { SpeakerVoices } from '../domain/ports/speaker-voices.port';
import type { SpokenTextGuard } from '../domain/ports/spoken-text-guard.port';
import type { VoiceAuditLog } from '../domain/ports/voice-audit-log.port';
import type { VoiceConsentRepository } from '../domain/ports/voice-consent.repository';

/** What every voice use case is built from. `speech` is `null` while speech is switched off. */
export interface VoiceDependencies {
  readonly authorization: AuthorizationService;
  readonly rateLimiter: RateLimiter;
  readonly speech: SpeechProvider | null;
  readonly voices: SpeakerVoices;
  readonly textGuard: SpokenTextGuard;
  readonly consents: VoiceConsentRepository;
  readonly audit: VoiceAuditLog;
  readonly clock: Clock;
}
