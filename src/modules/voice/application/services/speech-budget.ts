import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import type { RateLimiter } from '@lib/rate-limit';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/voice-errors';
import { VOICE_RATE_LIMITS } from '../rate-limits';

/** The unit `VOICE_RATE_LIMITS.dailyCharacters` counts in. */
const CHARACTERS_PER_UNIT = 100;

/**
 * Spends the global daily character budget for one real synthesis of `text`: one unit per started
 * hundred characters, so a reply of the maximum length costs four checks. Call it on a cache miss
 * only, right before the provider. Units counted before a refusal are not given back.
 */
export function spendSpeechCharacters(
  rateLimiter: RateLimiter,
  text: string,
): AppResultAsync<void, RateLimitedAppError | InfrastructureAppError> {
  const units = Math.ceil(text.length / CHARACTERS_PER_UNIT);
  let spent: AppResultAsync<void, RateLimitedAppError | InfrastructureAppError> =
    okAsync(undefined);
  for (let unit = 0; unit < units; unit += 1) {
    spent = spent.andThen(() =>
      rateLimiter
        .enforce({ policy: VOICE_RATE_LIMITS.dailyCharacters, subject: { kind: 'global' } })
        .mapErr(fromRateLimitFailure)
        .map(() => undefined),
    );
  }
  return spent;
}
