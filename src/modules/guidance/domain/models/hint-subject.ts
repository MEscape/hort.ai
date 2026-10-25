import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { literalGuard } from '@lib/utils';

import { GUIDANCE_VALIDATION_CODES, guidanceFieldInvalid } from '../errors/guidance-errors';

/**
 * The school subject of the child's task: it picks which curriculum grounds the hint (#28). The
 * same closed list as the curriculum module's subjects; the curriculum checks it again.
 */
export const HINT_SUBJECTS = ['math', 'german', 'general_studies', 'english'] as const;
export type HintSubject = (typeof HINT_SUBJECTS)[number];

const isHintSubject = literalGuard(HINT_SUBJECTS);

/** A subject that arrived from a request; anything outside the list is refused. */
export function parseHintSubject(raw: string): AppResult<HintSubject, ValidationAppError> {
  return isHintSubject(raw)
    ? ok(raw)
    : err(guidanceFieldInvalid('subject', GUIDANCE_VALIDATION_CODES.subjectInvalid));
}
