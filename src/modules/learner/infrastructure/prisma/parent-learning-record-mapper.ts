import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';

import { toParentTaskId } from '../../domain/models/ids';
import { PARENT_ANSWER_RESULTS, PARENT_HINT_LEVELS } from '../../domain/models/parent-learning';

import type {
  ParentAnswerEvidence,
  ParentAnswerResult,
  ParentSubject,
  ParentTask,
} from '../../domain/models/parent-learning';

export const PARENT_TASK_SELECT = [
  'id',
  'assignmentId',
  'status',
  'subject',
  'competencyCode',
  'startedAt',
  'updatedAt',
  'endedAt',
] as const;

export interface TaskRecord {
  readonly id: string;
  readonly assignmentId: string | null;
  readonly status: ParentTask['status'];
  readonly subject: ParentSubject;
  readonly competencyCode: string | null;
  readonly startedAt: InstantRecord;
  readonly updatedAt: InstantRecord;
  readonly endedAt: InstantRecord | null;
  readonly hintEvents: ReadonlyArray<{ readonly level: string }>;
  readonly childAnswers: ReadonlyArray<{ readonly id: string }>;
  // An assessment still being judged has no result yet (null).
  readonly answerAssessments: ReadonlyArray<{ readonly result: string | null }>;
  readonly comprehensionQuestions: ReadonlyArray<{ readonly repliedAt: InstantRecord | null }>;
}

const iso = (instant: InstantRecord) => instantToDate(instant).toISOString();

function answerEvidence(record: TaskRecord): ParentAnswerEvidence {
  const results: Record<ParentAnswerResult, number> = { CORRECT: 0, PARTLY_CORRECT: 0, NOT_YET: 0 };
  for (const { result } of record.answerAssessments) {
    // A result this build does not know is left out rather than guessed into a bucket.
    const known = PARENT_ANSWER_RESULTS.find((value) => value === result);
    if (known) {
      results[known] += 1;
    }
  }
  return { given: record.childAnswers.length, results };
}

/** Hint count and rungs are known together or not at all. */
function hintEvidence(record: TaskRecord, known: boolean) {
  if (!known) {
    return { hintCount: null, hintLevels: [] };
  }
  const usedLevels = new Set(record.hintEvents.map((hint) => hint.level));
  return {
    hintCount: record.hintEvents.length,
    hintLevels: PARENT_HINT_LEVELS.filter((level) => usedLevels.has(level)),
  };
}

function questionEvidence(record: TaskRecord, known: boolean) {
  return known
    ? {
        questionsAsked: record.comprehensionQuestions.length,
        questionsAnswered: record.comprehensionQuestions.filter(
          (question) => question.repliedAt !== null,
        ).length,
      }
    : { questionsAsked: null, questionsAnswered: null };
}

/**
 * Truncated evidence is unavailable rather than an undercount. Text never enters this projection;
 * the curriculum code is passed on for the app route to describe through the curriculum module.
 */
export function toParentTask(
  record: TaskRecord,
  insights: boolean,
  evidenceLimit: number,
): ParentTask {
  const hintsKnown = insights && record.hintEvents.length <= evidenceLimit;
  const answersKnown =
    insights &&
    record.childAnswers.length <= evidenceLimit &&
    record.answerAssessments.length <= evidenceLimit;
  const questionsKnown = insights && record.comprehensionQuestions.length <= evidenceLimit;
  return {
    id: toParentTaskId(record.id),
    assignmentId: record.assignmentId,
    status: record.status,
    startedAt: iso(record.startedAt),
    updatedAt: iso(record.updatedAt),
    endedAt: record.endedAt === null ? null : iso(record.endedAt),
    subject: record.subject,
    competencyCode: record.competencyCode,
    ...hintEvidence(record, hintsKnown),
    answers: answersKnown ? answerEvidence(record) : null,
    ...questionEvidence(record, questionsKnown),
    evidencePartial: insights && (!hintsKnown || !answersKnown || !questionsKnown),
  };
}
