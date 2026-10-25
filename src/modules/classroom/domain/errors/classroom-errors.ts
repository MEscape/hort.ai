import {
  conflictError,
  infrastructureError,
  notFoundError,
  rateLimitedError,
  validationError,
  FieldErrorBag,
} from '@lib/errors';
import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import type { RateLimitFailure } from '@lib/rate-limit';

/**
 * Stable codes. Presentation maps these to translation keys (i18n.md);
 * nothing here is user-facing prose.
 *
 * `notFound` is deliberately the ONE outcome for "no such classroom" and
 * "classroom of another teacher": codes reach the client, and a separate code
 * would disclose that the id exists elsewhere. Likewise `inviteCodeInvalid` is the one
 * outcome for an unknown, malformed, replaced or archived class's code.
 */
export const CLASSROOM_ERROR_CODES = {
  notFound: 'classroom.not_found',
  validationFailed: 'classroom.validation_failed',
  persistenceFailed: 'classroom.persistence_failed',
  archived: 'classroom.archived',
  inviteCodeInvalid: 'classroom.invite_code_invalid',
  childAlreadyInClassroom: 'classroom.child_already_in_classroom',
  rateLimited: 'classroom.rate_limited',
  rateLimiterFailed: 'classroom.rate_limiter_failed',
} as const;

/** Field-level codes, carried in `fieldErrors`. Also stable, also never prose. */
export const CLASSROOM_VALIDATION_CODES = {
  idInvalid: 'classroom.validation.id_invalid',
  required: 'classroom.validation.required',
  tooLong: 'classroom.validation.too_long',
  nameInvalid: 'classroom.validation.name_invalid',
  numberInvalid: 'classroom.validation.number_invalid',
  optionUnknown: 'classroom.validation.option_unknown',
} as const;

export type ClassroomErrorCode = (typeof CLASSROOM_ERROR_CODES)[keyof typeof CLASSROOM_ERROR_CODES];
export type ClassroomValidationCode =
  (typeof CLASSROOM_VALIDATION_CODES)[keyof typeof CLASSROOM_VALIDATION_CODES];
export type ClassroomCode = ClassroomErrorCode | ClassroomValidationCode;

/** Also covers another teacher's classroom: see `CLASSROOM_ERROR_CODES`. */
export function classroomNotFound(): NotFoundAppError {
  return notFoundError(CLASSROOM_ERROR_CODES.notFound, 'The classroom was not found.');
}

/** An archived class is read-only: it cannot be renamed and gets no new code. */
export function classroomArchived(): ConflictAppError {
  return conflictError(CLASSROOM_ERROR_CODES.archived, 'The classroom is archived.');
}

/** Unknown, malformed, replaced or archived: one outcome, so a guess learns nothing. */
export function inviteCodeInvalid(): NotFoundAppError {
  return notFoundError(CLASSROOM_ERROR_CODES.inviteCodeInvalid, 'The invite code is not valid.');
}

/** A child is in at most one class (B S, #8); leaving the current one comes first. */
export function childAlreadyInClassroom(): ConflictAppError {
  return conflictError(
    CLASSROOM_ERROR_CODES.childAlreadyInClassroom,
    'The child is already in a class.',
  );
}

export function classroomValidationFailed(
  fieldErrors: Record<string, string[]>,
): ValidationAppError {
  return validationError(
    CLASSROOM_ERROR_CODES.validationFailed,
    'The classroom input is invalid.',
    fieldErrors,
  );
}

/** One place wires the bag to this module's error factory. */
export function createClassroomErrorBag(): FieldErrorBag {
  return new FieldErrorBag(classroomValidationFailed);
}

/** A validation failure on a single field. */
export function fieldValidationFailed(
  field: string,
  code: ClassroomValidationCode,
): ValidationAppError {
  return classroomValidationFailed({ [field]: [code] });
}

/** A spent budget is this module's own `rateLimited`; a store failure its own infrastructure error. */
export function fromRateLimitFailure(
  failure: RateLimitFailure,
): RateLimitedAppError | InfrastructureAppError {
  return failure.kind === 'rate_limited'
    ? rateLimitedError(
        CLASSROOM_ERROR_CODES.rateLimited,
        'Too many attempts. Try again later.',
        failure.retryAfterSeconds,
      )
    : infrastructureError(
        CLASSROOM_ERROR_CODES.rateLimiterFailed,
        'Rate limiting is unavailable.',
        failure.cause,
      );
}
