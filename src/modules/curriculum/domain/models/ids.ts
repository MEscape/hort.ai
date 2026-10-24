import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { curriculumInvalid, CURRICULUM_VALIDATION_CODES } from '../errors/curriculum-errors';

/**
 * The class a child belongs to, as this module refers to it (the classroom module owns the
 * aggregate; the brand name is shared, the type is not).
 */
export type ClassroomId = Brand<string, 'ClassroomId'>;

/** Local reference to the learner aggregate; its authorized membership gates private grounding. */
export type ChildProfileId = Brand<string, 'ChildProfileId'>;
export function toChildProfileId(raw: string): ChildProfileId {
  return raw as ChildProfileId;
}
export const parseChildProfileId = createIdParser({
  isValid: (raw: string) => /^[A-Za-z0-9_-]{1,128}$/.test(raw),
  brand: toChildProfileId,
  mapError: () => curriculumInvalid('childProfileId', CURRICULUM_VALIDATION_CODES.invalid),
});

export const CLASSROOM_ID_MAX_LENGTH = 128;

/** Brands an id read from storage or handed over by a trusted caller. */
export function toClassroomId(raw: string): ClassroomId {
  return raw as ClassroomId; // Brand constructor: the cast is only permitted here.
}

/** Brands an id after checking its shape. */
export const parseClassroomId = createIdParser({
  isValid: (raw: string) => raw.length > 0 && raw.length <= CLASSROOM_ID_MAX_LENGTH,
  brand: toClassroomId,
  mapError: () => curriculumInvalid('classroomId', CURRICULUM_VALIDATION_CODES.invalid),
});
