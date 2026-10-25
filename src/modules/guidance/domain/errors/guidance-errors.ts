import { infrastructureError, rateLimitedError, validationError } from '@lib/errors';
import type { InfrastructureAppError, RateLimitedAppError, ValidationAppError } from '@lib/errors';
import type { RateLimitFailure } from '@lib/rate-limit';

/** Stable codes for asking for a hint (#10, #11). Presentation maps them to friendly text. */
export const GUIDANCE_ERROR_CODES = {
  validationFailed: 'guidance.validation_failed',
  rateLimited: 'guidance.rate_limited',
  rateLimiterFailed: 'guidance.rate_limiter_failed',
  sessionNotFound: 'guidance.session_not_found',
  sessionStoreFailed: 'guidance.session_store_failed',
} as const;

/** Field-level codes, carried in `fieldErrors`. */
export const GUIDANCE_VALIDATION_CODES = {
  childProfileIdInvalid: 'guidance.validation.child_profile_id_invalid',
  subjectInvalid: 'guidance.validation.subject_invalid',
  sessionIdInvalid: 'guidance.validation.session_id_invalid',
  requestIdInvalid: 'guidance.validation.request_id_invalid',
} as const;

export type GuidanceValidationCode =
  (typeof GUIDANCE_VALIDATION_CODES)[keyof typeof GUIDANCE_VALIDATION_CODES];

export function guidanceFieldInvalid(
  field: string,
  code: GuidanceValidationCode,
): ValidationAppError {
  return validationError(GUIDANCE_ERROR_CODES.validationFailed, 'The hint request is invalid.', {
    [field]: [code],
  });
}

/** A refusal of the shared limiter, in this module's own codes. */
export function fromRateLimitFailure(
  failure: RateLimitFailure,
): RateLimitedAppError | InfrastructureAppError {
  return failure.kind === 'rate_limited'
    ? rateLimitedError(
        GUIDANCE_ERROR_CODES.rateLimited,
        'Too many hint requests. Try again later.',
        failure.retryAfterSeconds,
      )
    : infrastructureError(
        GUIDANCE_ERROR_CODES.rateLimiterFailed,
        'The rate limit could not be checked.',
        failure.cause,
      );
}
