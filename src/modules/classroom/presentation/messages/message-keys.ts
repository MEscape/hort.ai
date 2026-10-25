import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors/validation';
import type { NestedKeyOf } from '@lib/errors/validation';

import {
  CLASSROOM_ERROR_CODES as ERRORS,
  CLASSROOM_VALIDATION_CODES as VALIDATION,
} from '../../application/contracts/classroom-constraints';

import type { ClassroomCode } from '../../application/contracts/classroom-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['classroom']>;

/**
 * Codes -> translation keys, relative to the `classroom` namespace. `satisfies Record<...>` makes a
 * new code fail to compile until it has a message. A rate limiter failure is a service error.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.notFound]: fieldPath('errors', 'notFound'),
  [ERRORS.validationFailed]: fieldPath('errors', 'validation'),
  [ERRORS.persistenceFailed]: fieldPath('errors', 'infrastructure'),
  [ERRORS.archived]: fieldPath('errors', 'archived'),
  [ERRORS.inviteCodeInvalid]: fieldPath('errors', 'inviteCodeInvalid'),
  [ERRORS.childAlreadyInClassroom]: fieldPath('errors', 'childAlreadyInClassroom'),
  [ERRORS.rateLimited]: fieldPath('errors', 'rateLimited'),
  [ERRORS.rateLimiterFailed]: fieldPath('errors', 'infrastructure'),
  [VALIDATION.idInvalid]: fieldPath('validation', 'idInvalid'),
  [VALIDATION.required]: fieldPath('validation', 'required'),
  [VALIDATION.tooLong]: fieldPath('validation', 'tooLong'),
  [VALIDATION.numberInvalid]: fieldPath('validation', 'numberInvalid'),
  [VALIDATION.optionUnknown]: fieldPath('validation', 'optionUnknown'),
} as const satisfies Record<ClassroomCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

export type MessageKey =
  (typeof MESSAGE_KEY_BY_CODE)[ClassroomCode] | typeof GENERIC_ERROR_MESSAGE_KEY;

function isClassroomCode(code: string): code is ClassroomCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/** Codes from other modules (authorization, learner) get the generic message. */
/** @keep Used by the class screens to translate an action error. */
export function messageKeyForCode(code: string): MessageKey {
  return isClassroomCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}
