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
  isValid: (raw: string) => raw.length > 0 && raw.length <= TEACHER_MATERIAL_ID_MAX_LENGTH,
  brand: toTeacherMaterialId,
  mapError: () => fieldValidationFailed('id', TEACHER_MATERIAL_VALIDATION_CODES.idInvalid),
});
