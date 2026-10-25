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

/** One help session of a child on one task (#17), owned by the session storage. */
export type HelpSessionId = Brand<string, 'HelpSessionId'>;

/** Long enough for a UUID with room to spare; the session storage decides whether it names a session. */
const HELP_SESSION_ID_MAX_LENGTH = 128;

/** Brands an id that came back from the session storage. Only infrastructure adapters call this. */
export function toHelpSessionId(raw: string): HelpSessionId {
  return raw as HelpSessionId; // Brand constructor: the cast is only permitted here.
}

export const parseHelpSessionId = createIdParser({
  isValid: (raw: string) => raw.length > 0 && raw.length <= HELP_SESSION_ID_MAX_LENGTH,
  brand: toHelpSessionId,
  mapError: () => guidanceFieldInvalid('sessionId', GUIDANCE_VALIDATION_CODES.sessionIdInvalid),
});

/**
 * The client's key for one step (a hint or an answer check), so a retried request is recognised
 * instead of counted twice. Stored as the step's idempotency key, which the database limits to 128.
 */
export type StepRequestId = Brand<string, 'StepRequestId'>;

/** Letters, digits, `-` and `_`: a UUID or a similar token, nothing a log reader could misread. */
const STEP_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;

/** Brands a request id read back from the session storage. Only infrastructure adapters call this. */
export function toStepRequestId(raw: string): StepRequestId {
  return raw as StepRequestId; // Brand constructor: the cast is only permitted here.
}

export const parseStepRequestId = createIdParser({
  isValid: (raw: string) => STEP_REQUEST_ID_PATTERN.test(raw),
  brand: toStepRequestId,
  mapError: () => guidanceFieldInvalid('requestId', GUIDANCE_VALIDATION_CODES.requestIdInvalid),
});
