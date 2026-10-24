import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors/validation';
import type { NestedKeyOf } from '@lib/errors/validation';

import {
  LEARNER_ERROR_CODES as ERRORS,
  LEARNER_VALIDATION_CODES as VALIDATION,
} from '../../application/contracts/learner-constraints';

import type { LearnerCode } from '../../application/contracts/learner-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['learner']>;

/**
 * Codes -> translation keys, relative to the `learner` namespace.
 * `satisfies Record<LearnerCode, ...>` makes a new code fail to compile
 * until it has a message.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.notFound]: fieldPath('errors', 'notFound'),
  [ERRORS.validationFailed]: fieldPath('errors', 'validation'),
  [ERRORS.persistenceFailed]: fieldPath('errors', 'infrastructure'),
  [VALIDATION.idInvalid]: fieldPath('validation', 'idInvalid'),
  [VALIDATION.required]: fieldPath('validation', 'required'),
  [VALIDATION.tooLong]: fieldPath('validation', 'tooLong'),
  [VALIDATION.numberInvalid]: fieldPath('validation', 'numberInvalid'),
  [VALIDATION.optionUnknown]: fieldPath('validation', 'optionUnknown'),
} as const satisfies Record<LearnerCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

export type MessageKey =
  (typeof MESSAGE_KEY_BY_CODE)[LearnerCode] | typeof GENERIC_ERROR_MESSAGE_KEY;

function isLearnerCode(code: string): code is LearnerCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/**
 * Codes from other modules (authorization, for instance) or from Zod's own
 * structural messages are unknown here and get the generic message.
 *
 * @keep Maps learner error codes to copy for the parent child-profile screens (#12).
 */
export function messageKeyForCode(code: string): MessageKey {
  return isLearnerCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}
