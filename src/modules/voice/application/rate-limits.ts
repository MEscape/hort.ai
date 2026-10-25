import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@lib/utils';

const VOICE_WINDOW_MINUTES = 10;
const VOICE_WINDOW_SECONDS = VOICE_WINDOW_MINUTES * SECONDS_PER_MINUTE;
const HOURS_PER_DAY = 24;
const SECONDS_PER_DAY = HOURS_PER_DAY * SECONDS_PER_HOUR;

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
  /**
   * Every synthesized character, of every caller, per day: the provider bills characters, so the
   * per-parent and per-channel budgets alone still let many accounts drain the monthly quota.
   * Counted in units of 100 characters (`speech-budget.ts`), only for a real synthesis, never for
   * a stored clip. 200 units are 20,000 characters a day.
   */
  dailyCharacters: {
    id: 'voice.daily-characters',
    limit: 200,
    windowSeconds: SECONDS_PER_DAY,
    onBackendFailure: 'deny',
  },
} as const satisfies Record<string, RateLimitPolicy>;
