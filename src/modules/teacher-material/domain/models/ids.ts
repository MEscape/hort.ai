import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import {
  TEACHER_MATERIAL_VALIDATION_CODES,
  fieldValidationFailed,
} from '../errors/teacher-material-errors';

/** Opaque identity of a teacher material. */
export type TeacherMaterialId = Brand<string, 'TeacherMaterialId'>;

export const TEACHER_MATERIAL_ID_MAX_LENGTH = 128;

/**
 * Brands an id read from storage. Only infrastructure adapters call this;
 * request values go through `parseTeacherMaterialId`.
 */
export function toTeacherMaterialId(raw: string): TeacherMaterialId {
  return raw as TeacherMaterialId; // Brand constructor: the cast is only permitted here.
}

/** Brands an id that arrived from a request, after checking its shape. */
export const parseTeacherMaterialId = createIdParser({
  isValid: (raw: string) =>
    /^[A-Za-z0-9_-]+$/.test(raw) && raw.length <= TEACHER_MATERIAL_ID_MAX_LENGTH,
  brand: toTeacherMaterialId,
  mapError: () => fieldValidationFailed('id', TEACHER_MATERIAL_VALIDATION_CODES.idInvalid),
});

export type ClassroomId = Brand<string, 'ClassroomId'>;
export function toClassroomId(raw: string): ClassroomId {
  return raw as ClassroomId;
}
export const parseClassroomId = createIdParser({
  isValid: (raw: string) => /^[A-Za-z0-9_-]{1,128}$/.test(raw),
  brand: toClassroomId,
  mapError: () => fieldValidationFailed('classroomId', TEACHER_MATERIAL_VALIDATION_CODES.idInvalid),
});
