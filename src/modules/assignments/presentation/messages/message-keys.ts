import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors';
import type { NestedKeyOf } from '@lib/errors';

import { ASSIGNMENT_VALIDATION_CODES as VALIDATION } from '../schemas/assignment-draft-schema';

import type { AssignmentCode } from '../schemas/assignment-draft-schema';

type ValidKeys = NestedKeyOf<MessageCatalog['assignments']>;

/**
 * Codes -> translation keys, relative to the `assignments` namespace.
 * `satisfies Record<AssignmentCode, ...>` makes a new code fail to compile until it has a message.
 */
export const MESSAGE_KEY_BY_CODE = {
  [VALIDATION.titleRequired]: fieldPath('validation', 'titleRequired'),
  [VALIDATION.titleTooLong]: fieldPath('validation', 'titleTooLong'),
  [VALIDATION.taskRequired]: fieldPath('validation', 'taskRequired'),
  [VALIDATION.taskTooLong]: fieldPath('validation', 'taskTooLong'),
  [VALIDATION.dateInvalid]: fieldPath('validation', 'dateInvalid'),
  [VALIDATION.solutionTooLong]: fieldPath('validation', 'solutionTooLong'),
} as const satisfies Record<AssignmentCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('validation', 'invalid');

export type MessageKey =
  (typeof MESSAGE_KEY_BY_CODE)[AssignmentCode] | typeof GENERIC_ERROR_MESSAGE_KEY;

function isAssignmentCode(code: string): code is AssignmentCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/** Codes from Zod's own structural messages are unknown here and get the generic message. */
export function messageKeyForCode(code: string): MessageKey {
  return isAssignmentCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}
