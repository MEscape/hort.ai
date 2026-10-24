import {
  forbiddenError,
  infrastructureError,
  notFoundError,
  rateLimitedError,
  validationError,
} from '@lib/errors';
import type {
  ForbiddenAppError,
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
  /** The speaker has no such fixed line in the catalog. */
  unknownPhrase: 'voice.unknown_phrase',
  /** The parent has not allowed this child's recordings to be transcribed: the interface uses text. */
  consentRequired: 'voice.consent_required',
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
  /** The request carried words to speak; only catalog lines and validated hints are spoken. */
  freeTextRefused: 'voice.validation.free_text_refused',
  /** The ticket is forged, expired or was issued to another parent. */
  ticketInvalid: 'voice.validation.ticket_invalid',
  /** No child profile id, or not one the learner module could have issued. */
  childProfileRequired: 'voice.validation.child_profile_required',
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

/** The speaker exists but has no such fixed line. */
export function unknownPhrase(): NotFoundAppError {
  return notFoundError(VOICE_ERROR_CODES.unknownPhrase, 'This speaker has no such line.');
}

/** Sending a recording to the provider leaves the session, so it needs the parent's consent. */
export function voiceConsentRequired(): ForbiddenAppError {
  return forbiddenError(
    VOICE_ERROR_CODES.consentRequired,
    'Speaking is not switched on for this child. Please type instead.',
  );
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
