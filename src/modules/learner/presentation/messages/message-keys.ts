import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors';
import type { NestedKeyOf } from '@lib/errors';

import {
  LEARNER_ERROR_CODES as ERRORS,
  LEARNER_LIMITS,
  LEARNER_VALIDATION_CODES as VALIDATION,
} from '../../application/contracts/learner-constraints';

import type { LearnerCode } from '../../application/contracts/learner-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['learner']>;

/**
 * Codes -> translation keys. Keys are absolute (the `learner` namespace is part of the key).
 * `satisfies Record<LearnerCode, ...>` makes a new code fail to compile until it has a message.
 * A missing or foreign profile reads as "not found" on purpose: the reason must not reach the client.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.notFound]: fieldPath('errors', 'notFound'),
  [ERRORS.alreadyOnboarded]: fieldPath('errors', 'alreadyOnboarded'),
  [ERRORS.setupIncomplete]: fieldPath('errors', 'setupIncomplete'),
  [ERRORS.welcomeAlreadyCompleted]: fieldPath('errors', 'welcomeAlreadyCompleted'),
  [ERRORS.devResetUnavailable]: fieldPath('errors', 'devResetUnavailable'),
  [ERRORS.voiceNoticeOutdated]: fieldPath('errors', 'voiceNoticeOutdated'),
  [ERRORS.validationFailed]: fieldPath('errors', 'validation'),
  [ERRORS.persistenceFailed]: fieldPath('errors', 'infrastructure'),
  [VALIDATION.idInvalid]: fieldPath('errors', 'unexpected'),
  [VALIDATION.displayNameRequired]: fieldPath('validation', 'displayNameRequired'),
  [VALIDATION.displayNameTooLong]: fieldPath('validation', 'displayNameTooLong'),
  [VALIDATION.displayNameInvalid]: fieldPath('validation', 'displayNameInvalid'),
  [VALIDATION.federalStateInvalid]: fieldPath('validation', 'federalStateInvalid'),
  [VALIDATION.gradeInvalid]: fieldPath('validation', 'gradeInvalid'),
  [VALIDATION.tutorInvalid]: fieldPath('validation', 'tutorInvalid'),
  [VALIDATION.interestsInvalid]: fieldPath('validation', 'interestsInvalid'),
  [VALIDATION.interestsTooMany]: fieldPath('validation', 'interestsTooMany'),
  [VALIDATION.dailyLimitInvalid]: fieldPath('validation', 'dailyLimitInvalid'),
  [VALIDATION.windowInvalid]: fieldPath('validation', 'windowInvalid'),
  [VALIDATION.guardianConfirmationRequired]: fieldPath(
    'validation',
    'guardianConfirmationRequired',
  ),
} as const satisfies Record<LearnerCode, ValidKeys>;

/** The request never got an answer (offline, dropped): not a code from the server, so it reads as the generic message. */
export const REQUEST_FAILED_CODE = 'request_failed';

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

export type MessageKey = (typeof MESSAGE_KEY_BY_CODE)[LearnerCode];

function isLearnerCode(code: string): code is LearnerCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/** Codes from auth or from Zod's own structural messages are unknown here and get the generic message. */
export function messageKeyForCode(code: string): MessageKey {
  return isLearnerCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}

/** Interpolation values for messages that mention a limit. */
export const MESSAGE_PARAMS = {
  displayNameMax: LEARNER_LIMITS.displayNameMax,
  maxInterests: LEARNER_LIMITS.maxInterests,
} as const;
