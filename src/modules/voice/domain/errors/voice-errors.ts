import { infrastructureError, notFoundError, rateLimitedError, validationError } from '@lib/errors';
import type {
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import type { RateLimitFailure } from '@lib/rate-limit';

/**
 * Stable codes of the voice module. A failure of the speech provider itself keeps the provider's
 * shared code (`speech.unavailable`, `speech.throttled`, `speech.quota_exceeded`,
 * `speech.rejected`), so the interface can tell "try again" from "an operator must act".
 */
export const VOICE_ERROR_CODES = {
  /** No speech provider is configured (`ELEVENLABS_API_KEY` unset): the interface falls back to text. */
  disabled: 'voice.disabled',
  unknownSpeaker: 'voice.unknown_speaker',
  validationFailed: 'voice.validation_failed',
  rateLimited: 'voice.rate_limited',
  rateLimiterFailed: 'voice.rate_limiter_failed',
} as const;

/** Field-level codes, carried in `fieldErrors`. */
export const VOICE_VALIDATION_CODES = {
  speakerInvalid: 'voice.validation.speaker_invalid',
  textRequired: 'voice.validation.text_required',
  textTooLong: 'voice.validation.text_too_long',
  recordingRequired: 'voice.validation.recording_required',
  recordingTooLarge: 'voice.validation.recording_too_large',
  recordingTypeUnsupported: 'voice.validation.recording_type_unsupported',
} as const;

export type VoiceErrorCode = (typeof VOICE_ERROR_CODES)[keyof typeof VOICE_ERROR_CODES];
export type VoiceValidationCode =
  (typeof VOICE_VALIDATION_CODES)[keyof typeof VOICE_VALIDATION_CODES];

export function voiceDisabled(): InfrastructureAppError {
  return infrastructureError(VOICE_ERROR_CODES.disabled, 'Speech is not available.');
}

/** The id names no tutor that is ready to speak and is not the narrator. */
export function unknownSpeaker(): NotFoundAppError {
  return notFoundError(VOICE_ERROR_CODES.unknownSpeaker, 'This speaker has no voice.');
}

export function invalidVoiceInput(field: string, code: VoiceValidationCode): ValidationAppError {
  return validationError(VOICE_ERROR_CODES.validationFailed, 'The input is invalid.', {
    [field]: [code],
  });
}

export function fromRateLimitFailure(
  failure: RateLimitFailure,
): RateLimitedAppError | InfrastructureAppError {
  return failure.kind === 'rate_limited'
    ? rateLimitedError(
        VOICE_ERROR_CODES.rateLimited,
        'Too many speech requests. Try again later.',
        failure.retryAfterSeconds,
      )
    : infrastructureError(
        VOICE_ERROR_CODES.rateLimiterFailed,
        'Speech is temporarily unavailable.',
        failure.cause,
      );
}
