import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { CLASSROOM_VALIDATION_CODES, fieldValidationFailed } from '../errors/classroom-errors';

/** Opaque identity of a classroom. */
export type ClassroomId = Brand<string, 'ClassroomId'>;

/**
 * A child profile of the learner module, referenced by id only (modules.md: a local branded
 * reference under the same brand name). Whether the parent owns it is the learner module's
 * decision, reached through `ChildProfileAccess`.
 */
export type ChildProfileId = Brand<string, 'ChildProfileId'>;

export const CLASSROOM_ID_MAX_LENGTH = 128;

/**
 * Brands an id read from storage. Only infrastructure adapters call this;
 * request values go through `parseClassroomId`.
 */
export function toClassroomId(raw: string): ClassroomId {
  return raw as ClassroomId; // Brand constructor: the cast is only permitted here.
}

/** Brands an id that arrived from a request, after checking its shape. */
export const parseClassroomId = createIdParser({
  isValid: (raw: string) => raw.length > 0 && raw.length <= CLASSROOM_ID_MAX_LENGTH,
  brand: toClassroomId,
  mapError: () => fieldValidationFailed('id', CLASSROOM_VALIDATION_CODES.idInvalid),
});

/** Brands a child profile id read from storage. */
export function toChildProfileId(raw: string): ChildProfileId {
  return raw as ChildProfileId; // Brand constructor: the cast is only permitted here.
}

/** Brands a child profile id that arrived from a request, after checking its shape. */
export const parseChildProfileId = createIdParser({
  isValid: (raw: string) => raw.length > 0 && raw.length <= CLASSROOM_ID_MAX_LENGTH,
  brand: toChildProfileId,
  mapError: () => fieldValidationFailed('childProfileId', CLASSROOM_VALIDATION_CODES.idInvalid),
});
