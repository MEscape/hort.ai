import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors';
import type { NestedKeyOf } from '@lib/errors';

import {
  LESSON_ERROR_CODES as ERRORS,
  LESSON_VALIDATION_CODES as VALIDATION,
} from '../../application/contracts/lesson-constraints';

import type { LessonCode } from '../../application/contracts/lesson-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['lesson']>;

/**
 * Codes -> translation keys (the `lesson` namespace is part of the key). A foreign child id reads
 * as "not found" on purpose; the technical codes share the generic sentence.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.notFound]: fieldPath('errors', 'notFound'),
  [ERRORS.validationFailed]: fieldPath('errors', 'validation'),
  [ERRORS.childDistress]: fieldPath('errors', 'childDistress'),
  [VALIDATION.idInvalid]: fieldPath('errors', 'unexpected'),
  [VALIDATION.answerInvalid]: fieldPath('errors', 'validation'),
} as const satisfies Record<LessonCode, ValidKeys>;

/** The request never got an answer (offline, dropped): not a code from the server. */
export const REQUEST_FAILED_CODE = 'request_failed';

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

export type MessageKey = (typeof MESSAGE_KEY_BY_CODE)[LessonCode];

function isLessonCode(code: string): code is LessonCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/** Codes from auth or from Zod's own structural messages are unknown here and get the generic message. */
export function messageKeyForCode(code: string): MessageKey {
  return isLessonCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}

type LeafKeyOf<T> = {
  [K in keyof T & string]: T[K] extends object ? `${K}.${LeafKeyOf<T[K]>}` : K;
}[keyof T & string];

/** A key of the authored lesson texts: `lessons.<lessonId>.<line>` or `lessons.<lessonId>.<stepId>.<line>`. */
export type LessonLineKey = `lessons.${LeafKeyOf<MessageCatalog['lesson']['lessons']>}`;

/**
 * Lesson lines are data (step ids and line names come from the authored lesson), so their keys are
 * built here, the one place that does it. A test checks every authored key in every catalog.
 */
export function lessonLineKey(lessonId: string, ...path: readonly string[]): LessonLineKey {
  return ['lessons', lessonId, ...path].join('.') as LessonLineKey;
}
