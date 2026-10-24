import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { LEARNER_VALIDATION_CODES, fieldValidationFailed } from '../errors/learner-errors';

/** Opaque identity of a child profile. */
export type ChildProfileId = Brand<string, 'ChildProfileId'>;

export const CHILD_PROFILE_ID_MAX_LENGTH = 128;

/**
 * Brands an id read from storage. Only infrastructure adapters call this;
 * request values go through `parseChildProfileId`.
 */
export function toChildProfileId(raw: string): ChildProfileId {
  return raw as ChildProfileId; // Brand constructor: the cast is only permitted here.
}

/** Brands an id that arrived from a request, after checking its shape. */
export const parseChildProfileId = createIdParser({
  isValid: (raw: string) => raw.length > 0 && raw.length <= CHILD_PROFILE_ID_MAX_LENGTH,
  brand: toChildProfileId,
  mapError: () => fieldValidationFailed('id', LEARNER_VALIDATION_CODES.idInvalid),
});
