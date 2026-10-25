import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import { isDefined, literalGuard } from '@lib/utils';

import { parseChildTaskText } from '../../domain/models/child-task-text';
import { toChildProfileId, toHelpSessionId, toStepRequestId } from '../../domain/models/ids';

import type { AssessmentResult } from '../../domain/ai-output/ai-output';
import type { ChildTaskText } from '../../domain/models/child-task-text';
import type {
  AnswerCheckStep,
  HelpSession,
  HelpSessionStatus,
} from '../../domain/models/help-session';
import type { GivenHint } from '../../domain/models/help-session-state';
import type { HintFallbackReason } from '../../domain/models/hint-fallback-reason';
import type { HintLevel } from '../../domain/models/hint-level';
import type { HintSubject } from '../../domain/models/hint-subject';
import type { AnswerAssessor } from '../../domain/ports/hint-session-store.port';
import type { SessionOpening, SessionTopic } from '../../domain/topic/session-topic';
import type { ChildMessageIntent } from '../../domain/topic/topic-classification';

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
  'intent',
  'opening',
  'competencyCode',
  'openTopicLabel',
  'classifiedBy',
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
} as const satisfies Record<AnswerAssessor, string>;

export const INTENT_RECORD = {
  homework: 'HOMEWORK',
  curiosity: 'CURIOSITY',
  small_talk: 'SMALL_TALK',
} as const satisfies Record<ChildMessageIntent, string>;

const OPENING_RECORD = {
  clarify: 'CLARIFY',
  redirect: 'REDIRECT',
} as const satisfies Record<SessionOpening['kind'], string>;

export const CLASSIFIED_BY_RECORD = {
  jev: 'JEV',
  fallback: 'FALLBACK',
} as const satisfies Record<NonNullable<SessionTopic['classifiedBy']>, string>;

const FALLBACK_REASONS = {
  timeout: true,
  provider_unavailable: true,
  invalid_output: true,
  solution_leaked: true,
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
const INTENT = invert(INTENT_RECORD);
const CLASSIFIED_BY = invert(CLASSIFIED_BY_RECORD);

export type LevelValue = ValueOf<typeof LEVEL_RECORD>;

export interface SessionRecord {
  readonly id: string;
  readonly childProfileId: string;
  readonly taskText: string;
  readonly subject: ValueOf<typeof SUBJECT_RECORD>;
  readonly status: ValueOf<typeof STATUS_RECORD>;
  readonly currentHintLevel: LevelValue | null;
  readonly intent: ValueOf<typeof INTENT_RECORD> | null;
  readonly opening: ValueOf<typeof OPENING_RECORD> | null;
  readonly competencyCode: string | null;
  readonly openTopicLabel: string | null;
  readonly classifiedBy: ValueOf<typeof CLASSIFIED_BY_RECORD> | null;
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
  const base = { requestId: toStepRequestId(record.idempotencyKey), level: LEVEL[record.level] };
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
  if (assessment === null) {
    return null;
  }
  const question = questions.get(record.idempotencyKey);
  return {
    requestId: toStepRequestId(record.idempotencyKey),
    answer: record.text,
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
/** The stored topic columns of a session (#92). */
export function toTopicRecord(topic: SessionTopic) {
  return {
    intent: topic.intent === null ? null : INTENT_RECORD[topic.intent],
    opening: topic.opening === null ? null : OPENING_RECORD[topic.opening.kind],
    competencyCode: topic.competencyCode,
    openTopicLabel: topic.openTopicLabel,
    classifiedBy: topic.classifiedBy === null ? null : CLASSIFIED_BY_RECORD[topic.classifiedBy],
  } as const;
}

/** `null` when the row breaks the redirect rule (the database refuses it too). */
function toTopic(session: SessionRecord): SessionTopic | null {
  const intent = session.intent === null ? null : INTENT[session.intent];
  const base = {
    intent,
    competencyCode: session.competencyCode,
    openTopicLabel: session.openTopicLabel,
    classifiedBy: session.classifiedBy === null ? null : CLASSIFIED_BY[session.classifiedBy],
  };
  if (session.opening === null) {
    return { ...base, opening: null };
  }
  if (session.opening === 'CLARIFY') {
    return { ...base, opening: { kind: 'clarify' } };
  }
  return intent === 'curiosity' || intent === 'small_talk'
    ? { ...base, opening: { kind: 'redirect', intent } }
    : null;
}

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
  const topic = toTopic(session);
  if (task === null || givenHints === null || answerChecks === null || topic === null) {
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
    topic,
  };
}
