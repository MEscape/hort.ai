import type { MessageCatalog } from '@i18n';

import type { NestedKeyOf } from '@lib/errors/validation';

import {
  VOICE_ERROR_CODES as ERRORS,
  VOICE_VALIDATION_CODES as VALIDATION,
} from '../../application/contracts/voice-constraints';
import type {
  VoiceErrorCode,
  VoiceValidationCode,
} from '../../application/contracts/voice-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['voice']>;
export const GENERIC_ERROR_MESSAGE_KEY = 'input.problem.failed';

/** Stable server codes become child-friendly wording; raw server messages are never shown. */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.disabled]: 'input.problem.failed',
  [ERRORS.unknownSpeaker]: 'input.problem.failed',
  [ERRORS.unknownPhrase]: 'input.problem.failed',
  [ERRORS.consentRequired]: 'input.problem.consent_required',
  [ERRORS.childProfileNotFound]: 'input.problem.consent_required',
  [ERRORS.validationFailed]: 'input.problem.failed',
  [ERRORS.rateLimited]: 'input.problem.busy',
  [ERRORS.rateLimiterFailed]: 'input.problem.failed',
  [ERRORS.hostingDisabled]: 'input.problem.failed',
  [ERRORS.clipFailed]: 'input.problem.failed',
  [ERRORS.messageNotFound]: 'input.problem.failed',
  [VALIDATION.speakerInvalid]: GENERIC_ERROR_MESSAGE_KEY,
  [VALIDATION.textRequired]: GENERIC_ERROR_MESSAGE_KEY,
  [VALIDATION.textTooLong]: GENERIC_ERROR_MESSAGE_KEY,
  [VALIDATION.recordingRequired]: GENERIC_ERROR_MESSAGE_KEY,
  [VALIDATION.recordingTooLarge]: GENERIC_ERROR_MESSAGE_KEY,
  [VALIDATION.recordingTypeUnsupported]: GENERIC_ERROR_MESSAGE_KEY,
  [VALIDATION.recordingContentMismatch]: GENERIC_ERROR_MESSAGE_KEY,
  [VALIDATION.freeTextRefused]: GENERIC_ERROR_MESSAGE_KEY,
  [VALIDATION.ticketInvalid]: GENERIC_ERROR_MESSAGE_KEY,
  [VALIDATION.childProfileRequired]: GENERIC_ERROR_MESSAGE_KEY,
} as const satisfies Record<VoiceErrorCode | VoiceValidationCode, ValidKeys>;

export function messageKeyForCode(code: string): ValidKeys {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code)
    ? MESSAGE_KEY_BY_CODE[code as keyof typeof MESSAGE_KEY_BY_CODE]
    : GENERIC_ERROR_MESSAGE_KEY;
}
