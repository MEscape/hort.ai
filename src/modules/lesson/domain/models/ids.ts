import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { LESSON_VALIDATION_CODES, fieldValidationFailed } from '../errors/lesson-errors';

/** The child doing the lesson. Same value as the learner module's profile id, branded here. */
export type ChildProfileId = Brand<string, 'ChildProfileId'>;

const ID_MAX_LENGTH = 128;

/** Brands an id read from storage or handed over by a module that already checked it. */
export function toChildProfileId(raw: string): ChildProfileId {
  return raw as ChildProfileId; // Brand constructor: the cast is only permitted here.
}

/** Brands a child id that arrived from a request, after checking its shape. */
export const parseChildProfileId = createIdParser({
  isValid: (raw: string) => raw.length > 0 && raw.length <= ID_MAX_LENGTH,
  brand: toChildProfileId,
  mapError: () => fieldValidationFailed('childProfileId', LESSON_VALIDATION_CODES.idInvalid),
});

/** A help session of the guidance module, as this module refers to it (the open task's session). */
export type HelpSessionId = Brand<string, 'HelpSessionId'>;

/** Brands a session id handed over by the guidance module, which already checked it. */
export function toHelpSessionId(raw: string): HelpSessionId {
  return raw as HelpSessionId; // Brand constructor: the cast is only permitted here.
}

/** Brands a session id that arrived from a request, after checking its shape. */
export const parseHelpSessionId = createIdParser({
  isValid: (raw: string) => raw.length > 0 && raw.length <= ID_MAX_LENGTH,
  brand: toHelpSessionId,
  mapError: () => fieldValidationFailed('sessionId', LESSON_VALIDATION_CODES.idInvalid),
});
