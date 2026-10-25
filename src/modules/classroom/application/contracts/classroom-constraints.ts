/**
 * Domain constants and codes that presentation legitimately needs (form validation, option lists,
 * message lookup). Presentation may not import the domain, so they are re-exported here as part of
 * the application's contract. Nothing in this file is defined twice.
 */
export {
  CLASSROOM_ERROR_CODES,
  CLASSROOM_VALIDATION_CODES,
} from '../../domain/errors/classroom-errors';
export type { ClassroomCode } from '../../domain/errors/classroom-errors';
export { CLASSROOM_ID_MAX_LENGTH } from '../../domain/models/ids';
export {
  CLASSROOM_LIMITS,
  CLASSROOM_NAME_PATTERN,
  CLASSROOM_FEDERAL_STATES,
  CLASSROOM_SUBJECTS,
} from '../../domain/models/classroom';
export type {
  ClassroomFederalState,
  ClassroomStatus,
  ClassroomSubject,
} from '../../domain/models/classroom';
