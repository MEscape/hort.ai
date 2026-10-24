import { validationError } from '@lib/errors';
import type { ValidationAppError } from '@lib/errors';

/** Stable codes. Presentation maps these to translation keys (i18n.md); nothing here is user-facing prose. */
export const AUDIT_ERROR_CODES = {
  validationFailed: 'audit.validation_failed',
  persistenceFailed: 'audit.persistence_failed',
} as const;

/** Field-level codes, carried in `fieldErrors`. */
export const AUDIT_VALIDATION_CODES = {
  idInvalid: 'audit.validation.id_invalid',
} as const;

export type AuditErrorCode = (typeof AUDIT_ERROR_CODES)[keyof typeof AUDIT_ERROR_CODES];
export type AuditValidationCode =
  (typeof AUDIT_VALIDATION_CODES)[keyof typeof AUDIT_VALIDATION_CODES];
export type AuditCode = AuditErrorCode | AuditValidationCode;

/** A validation failure on a single field. */
export function auditFieldInvalid(field: string, code: AuditValidationCode): ValidationAppError {
  return validationError(AUDIT_ERROR_CODES.validationFailed, 'The audit input is invalid.', {
    [field]: [code],
  });
}
