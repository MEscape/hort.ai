/**
 * Domain codes that presentation needs (form validation, message lookup). Presentation may not
 * import the domain, so they are re-exported here as part of the application's contract.
 */
export { ASSIGNMENTS_VALIDATION_CODES } from '../../domain/errors/assignment-errors';
export type { AssignmentCode } from '../../domain/errors/assignment-errors';
