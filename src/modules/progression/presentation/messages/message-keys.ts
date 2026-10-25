import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors';
import type { NestedKeyOf } from '@lib/errors';

import {
  PROGRESSION_ERROR_CODES as ERRORS,
  PROGRESSION_VALIDATION_CODES as VALIDATION,
} from '../../application/contracts/progression-constraints';

import type { ProgressionCode } from '../../application/contracts/progression-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['progression']>;

/**
 * Codes -> translation keys (the `progression` namespace is part of the key). A child sees only
 * "that did not work, try again": a foreign child id reads as "not found" on purpose and the
 * technical codes all share the generic sentence. A new code fails to compile until it has a message.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.notFound]: fieldPath('errors', 'notFound'),
  [ERRORS.validationFailed]: fieldPath('errors', 'validation'),
  [ERRORS.persistenceFailed]: fieldPath('errors', 'infrastructure'),
  [VALIDATION.idInvalid]: fieldPath('errors', 'unexpected'),
  [VALIDATION.eventInvalid]: fieldPath('errors', 'unexpected'),
  [VALIDATION.eventKeyInvalid]: fieldPath('errors', 'unexpected'),
} as const satisfies Record<ProgressionCode, ValidKeys>;

/** The request never got an answer (offline, dropped): not a code from the server, so it reads as the generic message. */
export const REQUEST_FAILED_CODE = 'request_failed';

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

export type MessageKey = (typeof MESSAGE_KEY_BY_CODE)[ProgressionCode];

function isProgressionCode(code: string): code is ProgressionCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/** Codes from auth or from Zod's own structural messages are unknown here and get the generic message. */
export function messageKeyForCode(code: string): MessageKey {
  return isProgressionCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}
