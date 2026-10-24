import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors';
import type { NestedKeyOf } from '@lib/errors';

import { ASSIGNMENT_VALIDATION_CODES as VALIDATION } from '../schemas/assignment-draft-schema';

import type { AssignmentValidationCode } from '../schemas/assignment-draft-schema';

type ValidKeys = NestedKeyOf<MessageCatalog['assignments']>;

/** Every local validation code must map to an existing key in the assignments namespace. */
export const MESSAGE_KEY_BY_CODE = {
  [VALIDATION.titleRequired]: fieldPath('validation', 'titleRequired'),
  [VALIDATION.titleTooLong]: fieldPath('validation', 'titleTooLong'),
  [VALIDATION.taskRequired]: fieldPath('validation', 'taskRequired'),
  [VALIDATION.taskTooLong]: fieldPath('validation', 'taskTooLong'),
  [VALIDATION.dateInvalid]: fieldPath('validation', 'dateInvalid'),
  [VALIDATION.solutionTooLong]: fieldPath('validation', 'solutionTooLong'),
} as const satisfies Record<AssignmentValidationCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

type MessageKey =
  (typeof MESSAGE_KEY_BY_CODE)[AssignmentValidationCode] | typeof GENERIC_ERROR_MESSAGE_KEY;

function isAssignmentValidationCode(code: string): code is AssignmentValidationCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/** Unknown codes and Zod's structural messages get a translated generic message. */
export function messageKeyForCode(code: string): MessageKey {
  return isAssignmentValidationCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}
