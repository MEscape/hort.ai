import type { AuthorizationService } from '@modules/auth';

import type { RateLimiter } from '@lib/rate-limit';
import type { SpeechProvider } from '@lib/speech';

import type { SpeakerVoices } from '../domain/ports/speaker-voices.port';

/** What every voice use case is built from. `speech` is `null` while speech is switched off. */
export interface VoiceDependencies {
  readonly authorization: AuthorizationService;
  readonly rateLimiter: RateLimiter;
  readonly speech: SpeechProvider | null;
  readonly voices: SpeakerVoices;
}
