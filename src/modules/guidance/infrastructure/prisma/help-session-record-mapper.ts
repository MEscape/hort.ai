import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import { isDefined, literalGuard } from '@lib/utils';

import { parseChildTaskText } from '../../domain/models/child-task-text';
import { toChildProfileId, toHelpSessionId } from '../../domain/models/ids';

import type { AssessmentResult } from '../../domain/ai-output/ai-output';
import type { AssessedBy } from '../../domain/models/assessed-by';
import type { ChildTaskText } from '../../domain/models/child-task-text';
import type {
  AnswerCheckStep,
  GivenHint,
  HelpSession,
  HelpSessionStatus,
} from '../../domain/models/help-session';
import type { HintFallbackReason } from '../../domain/models/hint-fallback-reason';
import type { HintLevel } from '../../domain/models/hint-level';
import type { HintSubject } from '../../domain/models/hint-subject';

/**
 * The columns the module reads, and nothing else, so no generated database type leaves this layer.
 * The domain's lower-case vocabulary maps to the schema's enum values here and only here.
 */
export const SESSION_SELECT = [
  'id',
  'childProfileId',
  'taskText',
  'subject',
  'status',
  'currentHintLevel',
  'startedAt',
  'updatedAt',
] as const;
export const HINT_SELECT = [
  'idempotencyKey',
  'level',
  'text',
  'fallbackReason',
  'occurredAt',
] as const;
export const ANSWER_SELECT = ['idempotencyKey', 'text', 'occurredAt'] as const;
export const ASSESSMENT_SELECT = ['result', 'assessedBy', 'hintLevel', 'text'] as const;
export const QUESTION_SELECT = ['idempotencyKey', 'text', 'replyText'] as const;

export const STATUS_RECORD = {
  active: 'ACTIVE',
  completed: 'COMPLETED',
  abandoned: 'ABANDONED',
} as const satisfies Record<HelpSessionStatus, string>;

export const LEVEL_RECORD = {
  understand_task: 'UNDERSTAND_TASK',
  activate_prior_knowledge: 'ACTIVATE_PRIOR_KNOWLEDGE',
  next_step: 'NEXT_STEP',
  similar_example: 'SIMILAR_EXAMPLE',
} as const satisfies Record<HintLevel, string>;

export const SUBJECT_RECORD = {
  math: 'MATH',
  german: 'GERMAN',
  general_studies: 'GENERAL_STUDIES',
  english: 'ENGLISH',
} as const satisfies Record<HintSubject, string>;

export const RESULT_RECORD = {
  correct: 'CORRECT',
  partly_correct: 'PARTLY_CORRECT',
  not_yet: 'NOT_YET',
} as const satisfies Record<AssessmentResult, string>;

export const ASSESSED_BY_RECORD = {
  solution_key: 'SOLUTION_KEY',
  ai: 'AI',
} as const satisfies Record<AssessedBy, string>;

const FALLBACK_REASONS = {
  timeout: true,
  provider_unavailable: true,
  invalid_output: true,
  unsafe_output: true,
} as const satisfies Record<HintFallbackReason, true>;

const isFallbackReason = literalGuard(
  Object.keys(FALLBACK_REASONS) as readonly HintFallbackReason[],
);

type ValueOf<T> = T[keyof T];

/** The schema value back to the domain word. The tables only hold values of these sets (enum checks). */
function invert<K extends string, V extends string>(record: Record<K, V>): Record<V, K> {
  return Object.fromEntries(
    (Object.keys(record) as K[]).map((key) => [record[key], key]),
  ) as Record<V, K>;
}

const STATUS = invert(STATUS_RECORD);
const LEVEL = invert(LEVEL_RECORD);
const SUBJECT = invert(SUBJECT_RECORD);
const RESULT = invert(RESULT_RECORD);
const ASSESSOR = invert(ASSESSED_BY_RECORD);

export type LevelValue = ValueOf<typeof LEVEL_RECORD>;

export interface SessionRecord {
  readonly id: string;
  readonly childProfileId: string;
  readonly taskText: string;
  readonly subject: ValueOf<typeof SUBJECT_RECORD>;
  readonly status: ValueOf<typeof STATUS_RECORD>;
  readonly currentHintLevel: LevelValue | null;
  readonly startedAt: InstantRecord;
  readonly updatedAt: InstantRecord;
}

export interface HintRecord {
  readonly idempotencyKey: string;
  readonly level: LevelValue;
  readonly text: string | null;
  readonly fallbackReason: string | null;
  readonly occurredAt: InstantRecord;
}

export interface AnswerRecord {
  readonly idempotencyKey: string;
  readonly text: string;
  readonly occurredAt: InstantRecord;
  readonly assessment: {
    readonly result: ValueOf<typeof RESULT_RECORD> | null;
    readonly assessedBy: ValueOf<typeof ASSESSED_BY_RECORD> | null;
    readonly hintLevel: LevelValue | null;
    readonly text: string | null;
  } | null;
}

export interface QuestionRecord {
  readonly idempotencyKey: string;
  readonly text: string | null;
  readonly replyText: string | null;
}

export interface SessionRecords {
  readonly session: SessionRecord;
  /** Oldest first. */
  readonly hints: readonly HintRecord[];
  /** Oldest first. */
  readonly answers: readonly AnswerRecord[];
  readonly questions: readonly QuestionRecord[];
}

function toChildText(raw: string): ChildTaskText | null {
  const parsed = parseChildTaskText(raw);
  return parsed.isOk() ? parsed.value : null;
}

function toGivenHint(record: HintRecord): GivenHint | null {
  const base = { requestId: record.idempotencyKey, level: LEVEL[record.level] };
  if (record.text !== null) {
    return { ...base, kind: 'generated', text: record.text };
  }
  return record.fallbackReason !== null && isFallbackReason(record.fallbackReason)
    ? { ...base, kind: 'fallback', reason: record.fallbackReason }
    : null;
}

function toAnswerCheck(
  record: AnswerRecord,
  questions: ReadonlyMap<string, QuestionRecord>,
): AnswerCheckStep | null {
  const { assessment } = record;
  const answer = toChildText(record.text);
  if (assessment === null || answer === null) {
    return null;
  }
  const question = questions.get(record.idempotencyKey);
  return {
    requestId: record.idempotencyKey,
    answer,
    result: assessment.result === null ? null : RESULT[assessment.result],
    assessedBy: assessment.assessedBy === null ? null : ASSESSOR[assessment.assessedBy],
    hintLevel: assessment.hintLevel === null ? null : LEVEL[assessment.hintLevel],
    feedbackText: assessment.text,
    question: question === undefined ? null : { text: question.text, reply: question.replyText },
    occurredAt: instantToDate(record.occurredAt),
  };
}

function allOrNull<T>(items: ReadonlyArray<T | null>): readonly T[] | null {
  const present = items.filter(isDefined);
  return present.length === items.length ? present : null;
}

/**
 * Rebuilds the domain session from its rows. An answer, its assessment and the question that
 * follows it share the check's request id, which pairs them here. `null` when a row breaks the
 * contract (a value another writer put there): a fault of the store, never half a session.
 */
export function toHelpSession({
  session,
  hints,
  answers,
  questions,
}: SessionRecords): HelpSession | null {
  const questionByKey = new Map(questions.map((question) => [question.idempotencyKey, question]));
  const task = toChildText(session.taskText);
  const givenHints = allOrNull(hints.map(toGivenHint));
  const answerChecks = allOrNull(answers.map((answer) => toAnswerCheck(answer, questionByKey)));
  if (task === null || givenHints === null || answerChecks === null) {
    return null;
  }
  return {
    id: toHelpSessionId(session.id),
    childProfileId: toChildProfileId(session.childProfileId),
    task,
    subject: SUBJECT[session.subject],
    status: STATUS[session.status],
    hintLevel: session.currentHintLevel === null ? null : LEVEL[session.currentHintLevel],
    startedAt: instantToDate(session.startedAt),
    updatedAt: instantToDate(session.updatedAt),
    hints: givenHints,
    answerChecks,
  };
}
