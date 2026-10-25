import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { GUIDANCE_VALIDATION_CODES, guidanceFieldInvalid } from '../errors/guidance-errors';

/**
 * A child profile, owned by the learner module. Declared here under the same brand name, so the
 * value crosses without mapping and the modules share no types (docs/rules/modules.md).
 */
export type ChildProfileId = Brand<string, 'ChildProfileId'>;

/** The learner module's own limit; a longer value cannot name a profile. */
const CHILD_PROFILE_ID_MAX_LENGTH = 128;

/** Brands an id that came back from the learner module. Only infrastructure adapters call this. */
export function toChildProfileId(raw: string): ChildProfileId {
  return raw as ChildProfileId; // Brand constructor: the cast is only permitted here.
}

/** Brands an id that arrived from a request, after checking its shape. */
export const parseChildProfileId = createIdParser({
  isValid: (raw: string) => raw.length > 0 && raw.length <= CHILD_PROFILE_ID_MAX_LENGTH,
  brand: toChildProfileId,
  mapError: () =>
    guidanceFieldInvalid('childProfileId', GUIDANCE_VALIDATION_CODES.childProfileIdInvalid),
});
