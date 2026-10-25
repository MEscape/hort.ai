import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { PROGRESSION_VALIDATION_CODES, fieldValidationFailed } from '../errors/progression-errors';

/** The child a progress belongs to. Same value as the learner module's profile id, branded here. */
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
  mapError: () => fieldValidationFailed('childProfileId', PROGRESSION_VALIDATION_CODES.idInvalid),
});
