import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { clamp, isDefined } from '@lib/utils';

import { curriculumInvalid, CURRICULUM_VALIDATION_CODES } from '../../domain/errors/curriculum-errors';
import {
  isCurriculumFederalState,
  isCurriculumGrade,
  isCurriculumSubject,
} from '../../domain/models/curriculum-scope';
import { toCleanLine } from '../../domain/parsing/untrusted-text';
import {
  RELEVANT_COMPETENCIES_DEFAULT,
  RELEVANT_COMPETENCIES_MAX,
  TASK_TEXT_MAX,
} from '../curriculum-limits';

import type {
  CurriculumFederalState,
  CurriculumSubject,
} from '../../domain/models/curriculum-scope';
import type { RelevantCompetenciesRequest } from '../contracts/curriculum-inputs';

export interface RelevanceQuery {
  readonly federalState: CurriculumFederalState;
  readonly grade: number;
  readonly subject: CurriculumSubject;
  readonly task: string;
  readonly classroomId: string | null;
  readonly limit: number;
}

const CODES = CURRICULUM_VALIDATION_CODES;
const CLASSROOM_ID_MAX = 128;

/** Checks a retrieval request; the task is cleaned and cut to what retrieval reads. */
export function parseRelevanceQuery(
  request: RelevantCompetenciesRequest,
): AppResult<RelevanceQuery, ValidationAppError> {
  const federalState = request.federalState.toLowerCase();
  const subject = request.subject.toLowerCase();
  const classroomId = request.classroomId ?? null;
  if (!isCurriculumFederalState(federalState)) {
    return err(curriculumInvalid('federalState', CODES.invalid));
  }
  if (!isCurriculumSubject(subject)) {
    return err(curriculumInvalid('subject', CODES.invalid));
  }
  if (!isCurriculumGrade(request.grade)) {
    return err(curriculumInvalid('grade', CODES.invalid));
  }
  if (classroomId !== null && (classroomId.length === 0 || classroomId.length > CLASSROOM_ID_MAX)) {
    return err(curriculumInvalid('classroomId', CODES.invalid));
  }
  const requested =
    isDefined(request.limit) && Number.isInteger(request.limit)
      ? request.limit
      : RELEVANT_COMPETENCIES_DEFAULT;
  return ok({
    federalState,
    subject,
    grade: request.grade,
    task: toCleanLine(Array.from(request.task).slice(0, TASK_TEXT_MAX).join('')),
    classroomId,
    limit: clamp(requested, 1, RELEVANT_COMPETENCIES_MAX),
  });
}
