/**
 * Domain constants and codes that presentation legitimately needs (form
 * validation, option lists, message lookup). Presentation may not import
 * the domain, so they are re-exported here as part of the application's
 * contract. Nothing in this file is defined twice.
 */
export {
  TEACHER_MATERIAL_ERROR_CODES,
  TEACHER_MATERIAL_VALIDATION_CODES,
} from '../../domain/errors/teacher-material-errors';
export type { TeacherMaterialCode } from '../../domain/errors/teacher-material-errors';
export {
  MATERIAL_MAX_BYTES,
  MATERIAL_POWERPOINT_CONTENT_TYPE,
  MATERIAL_WORD_CONTENT_TYPE,
} from '../../domain/models/material';
export { MATERIAL_QUERY_LIMITS } from '../material-limits';
export { TEACHER_MATERIAL_ID_MAX_LENGTH } from '../../domain/models/ids';
