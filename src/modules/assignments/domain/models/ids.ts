import { validationError } from '@lib/errors';
import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

export type AssignmentId = Brand<string, 'AssignmentId'>;
/** The class identity is compatible with the classroom module's same branded vocabulary. */
export type ClassroomId = Brand<string, 'ClassroomId'>;

export function toAssignmentId(raw: string): AssignmentId {
  return raw as AssignmentId;
}

export function toClassroomId(raw: string): ClassroomId {
  return raw as ClassroomId;
}

const invalidId = () => validationError('assignments.invalid_id', 'Invalid identifier.', {});
const ID_MAX_LENGTH = 128;
const isValidId = (raw: string) => raw.length > 0 && raw.length <= ID_MAX_LENGTH;

export const parseAssignmentId = createIdParser({
  isValid: isValidId,
  brand: toAssignmentId,
  mapError: invalidId,
});

export const parseClassroomId = createIdParser({
  isValid: isValidId,
  brand: toClassroomId,
  mapError: invalidId,
});
