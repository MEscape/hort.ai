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
export { TEACHER_MATERIAL_ID_MAX_LENGTH } from '../../domain/models/ids';
export { TEACHER_MATERIAL_LIMITS } from '../../domain/models/teacher-material';
