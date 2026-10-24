import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors/validation';
import type { NestedKeyOf } from '@lib/errors/validation';

import {
  TEACHER_MATERIAL_ERROR_CODES as ERRORS,
  TEACHER_MATERIAL_VALIDATION_CODES as VALIDATION,
} from '../../application/contracts/teacher-material-constraints';

import type { TeacherMaterialCode } from '../../application/contracts/teacher-material-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['teacherMaterial']>;

/**
 * Codes -> translation keys, relative to the `teacherMaterial` namespace.
 * `satisfies Record<TeacherMaterialCode, ...>` makes a new code fail to compile
 * until it has a message.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.notFound]: fieldPath('errors', 'notFound'),
  [ERRORS.validationFailed]: fieldPath('errors', 'validation'),
  [ERRORS.persistenceFailed]: fieldPath('errors', 'infrastructure'),
  [VALIDATION.idInvalid]: fieldPath('validation', 'idInvalid'),
  [VALIDATION.required]: fieldPath('validation', 'required'),
  [VALIDATION.tooLong]: fieldPath('validation', 'tooLong'),
} as const satisfies Record<TeacherMaterialCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

export type MessageKey =
  (typeof MESSAGE_KEY_BY_CODE)[TeacherMaterialCode] | typeof GENERIC_ERROR_MESSAGE_KEY;

function isTeacherMaterialCode(code: string): code is TeacherMaterialCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/**
 * Codes from other modules (authorization, for instance) or from Zod's own
 * structural messages are unknown here and get the generic message.
 */
export function messageKeyForCode(code: string): MessageKey {
  return isTeacherMaterialCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}
