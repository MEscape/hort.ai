import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_MINUTE } from '@lib/utils';

const VOICE_WINDOW_MINUTES = 10;
const VOICE_WINDOW_SECONDS = VOICE_WINDOW_MINUTES * SECONDS_PER_MINUTE;

/**
 * Budgets per signed-in parent. Each attempt is a paid call to the speech provider (characters
 * for speech, minutes for transcription), so a stuck loop or a script must not drain the monthly
 * quota: 30 calls in ten minutes is a lively conversation, not a flood. Both deny when the
 * limiter's store is down, as every budget guarding an external call does.
 */
export const VOICE_RATE_LIMITS = {
  synthesize: {
    id: 'voice.synthesize',
    limit: 30,
    windowSeconds: VOICE_WINDOW_SECONDS,
    onBackendFailure: 'deny',
  },
  /**
   * Hosted speech for anonymous channels (Alexa), one budget for all of them: only a synthesis
   * counts, a clip served from storage is free. 60 in ten minutes is far above a demo and caps a
   * runaway loop at a few thousand billed characters.
   */
  hostedSynthesize: {
    id: 'voice.hosted-synthesize',
    limit: 60,
    windowSeconds: VOICE_WINDOW_SECONDS,
    onBackendFailure: 'deny',
  },
  transcribe: {
    id: 'voice.transcribe',
    limit: 30,
    windowSeconds: VOICE_WINDOW_SECONDS,
    onBackendFailure: 'deny',
  },
} as const satisfies Record<string, RateLimitPolicy>;
