/**
 * Domain constants and codes that presentation legitimately needs (form
 * validation, message lookup). Presentation may not import the domain, so
 * they are re-exported here as part of the application's contract. Nothing
 * in this file is defined twice.
 */
export { AUTH_ERROR_CODES, AUTH_VALIDATION_CODES } from '../../domain/errors/auth-errors';
export type { AuthCode } from '../../domain/errors/auth-errors';
export {
  AUTH_LINK_LIFETIME_SECONDS,
  CREDENTIAL_LIMITS,
  EMAIL_PATTERN,
} from '../../domain/models/credentials';
