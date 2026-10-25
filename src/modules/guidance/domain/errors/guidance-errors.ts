import {
  forbiddenError,
  infrastructureError,
  notFoundError,
  rateLimitedError,
  validationError,
} from '@lib/errors';
import type {
  ForbiddenAppError,
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import type { RateLimitFailure } from '@lib/rate-limit';

/** Stable codes for asking for a hint (#10, #11). Presentation maps them to friendly text. */
export const GUIDANCE_ERROR_CODES = {
  validationFailed: 'guidance.validation_failed',
  rateLimited: 'guidance.rate_limited',
  rateLimiterFailed: 'guidance.rate_limiter_failed',
  /** No active help session of this child with this id: missing, ended or someone else's (#17). */
  sessionNotFound: 'guidance.session_not_found',
  /** The help session could not be read or written. */
  sessionStoreFailed: 'guidance.session_store_failed',
  /** The child replied, but the session asks no comprehension question right now (#78). */
  noOpenQuestion: 'guidance.no_open_question',
  /**
   * No assignment with this id in the class the child is in (#33): missing, deleted, another class's,
   * or the child is in no class. One code for all, so an id of another class discloses nothing.
   */
  assignmentNotFound: 'guidance.assignment_not_found',
  /** The child's words say they may be in danger (#90): no AI, nothing stored, the trusted-adult notice. */
  childDistress: 'guidance.child_distress',
  /** The comprehension reply says nothing ("?", "weiß nicht"); the child is asked for their own words. */
  replyNotAnAnswer: 'guidance.reply_not_an_answer',
  /**
   * The parent's daily limit is used up or it is outside the allowed hours (`computeScreenTime` on
   * the server's clock): no new session and no step, nothing stored, no AI. The task stays saved.
   */
  learningPaused: 'guidance.learning_paused',
  /** A session that opened with the friendly redirect (small talk, curiosity, #92) gives no hint. */
  noHintForOpening: 'guidance.no_hint_for_opening',
} as const;

/** Field-level codes, carried in `fieldErrors`. */
export const GUIDANCE_VALIDATION_CODES = {
  childProfileIdInvalid: 'guidance.validation.child_profile_id_invalid',
  subjectInvalid: 'guidance.validation.subject_invalid',
  sessionIdInvalid: 'guidance.validation.session_id_invalid',
  requestIdInvalid: 'guidance.validation.request_id_invalid',
  assignmentIdInvalid: 'guidance.validation.assignment_id_invalid',
  /** Not a world island, or a place of another island (or a place without an island). */
  areaInvalid: 'guidance.validation.area_invalid',
  classroomIdInvalid: 'guidance.validation.classroom_id_invalid',
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

/** See `GUIDANCE_ERROR_CODES.learningPaused`. The parent's controls forbid learning right now. */
export function learningPaused(): ForbiddenAppError {
  return forbiddenError(GUIDANCE_ERROR_CODES.learningPaused, 'Learning is paused for today.');
}

/** See `GUIDANCE_ERROR_CODES.assignmentNotFound`. */
export function assignmentNotFound(): NotFoundAppError {
  return notFoundError(GUIDANCE_ERROR_CODES.assignmentNotFound, 'The assignment was not found.');
}
