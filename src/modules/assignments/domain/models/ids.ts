import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { invalidAssignmentId } from '../errors/assignment-errors';

export type AssignmentId = Brand<string, 'AssignmentId'>;
/** The class identity is compatible with the classroom module's same branded vocabulary. */
export type ClassroomId = Brand<string, 'ClassroomId'>;

export function toAssignmentId(raw: string): AssignmentId {
  return raw as AssignmentId;
}

export function toClassroomId(raw: string): ClassroomId {
  return raw as ClassroomId;
}

const ID_MAX_LENGTH = 128;
const isValidId = (raw: string) => raw.length > 0 && raw.length <= ID_MAX_LENGTH;

export const parseAssignmentId = createIdParser({
  isValid: isValidId,
  brand: toAssignmentId,
  mapError: invalidAssignmentId,
});

export const parseClassroomId = createIdParser({
  isValid: isValidId,
  brand: toClassroomId,
  mapError: invalidAssignmentId,
});

/** The learner's child profile, under the learner module's brand name (no shared type, no cycle). */
export type ChildProfileId = Brand<string, 'ChildProfileId'>;

export function toChildProfileId(raw: string): ChildProfileId {
  return raw as ChildProfileId;
}

export const parseChildProfileId = createIdParser({
  isValid: isValidId,
  brand: toChildProfileId,
  mapError: invalidAssignmentId,
});
