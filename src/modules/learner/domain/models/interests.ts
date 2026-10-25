import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { literalGuard } from '@lib/utils';

import { LEARNER_VALIDATION_CODES, fieldValidationFailed } from '../errors/learner-errors';

import { LEARNER_LIMITS } from './learner-limits';

/** What the child likes, as a closed list: a parent picks from it, nothing is typed in. */
export const INTERESTS = [
  'nature',
  'animals',
  'science',
  'art',
  'music',
  'sports',
  'technology',
  'stories',
  'puzzles',
  'history',
] as const;

export type Interest = (typeof INTERESTS)[number];

export const isInterest = literalGuard(INTERESTS);

/**
 * Zero to `maxInterests` distinct values from the list (skipping is valid). Returned in the list's
 * own order, so two choices of the same set are equal.
 */
export function createInterests(
  raw: readonly string[],
): AppResult<readonly Interest[], ValidationAppError> {
  const codes = LEARNER_VALIDATION_CODES;
  if (raw.length > LEARNER_LIMITS.maxInterests) {
    return err(fieldValidationFailed('interests', codes.interestsTooMany));
  }
  if (!raw.every(isInterest) || new Set(raw).size !== raw.length) {
    return err(fieldValidationFailed('interests', codes.interestsInvalid));
  }
  return ok(INTERESTS.filter((interest) => raw.includes(interest)));
}

/** Whether two canonical choices hold the same interests. */
export function sameInterests(a: readonly Interest[], b: readonly Interest[]): boolean {
  return a.length === b.length && a.every((interest, index) => interest === b[index]);
}
