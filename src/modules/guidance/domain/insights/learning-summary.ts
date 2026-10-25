import { HINT_LEVELS } from '../models/hint-level';

import type { HelpSessionStatus } from '../models/help-session';
import type { HintLevel } from '../models/hint-level';

/** The parent's summary looks back this far (#35). */
export const SUMMARY_WINDOW_DAYS = 14;
/** At most this many help sessions, newest first. */
export const SUMMARY_SESSION_LIMIT = 10;
/** From this many hints on a task, the summary says the child needed many. */
export const MANY_HINTS = 3;
/** A shown label is cut to this length, so a long curriculum text stays one short line. */
export const LABEL_MAX_LENGTH = 80;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Since when the summary reads sessions, on the application clock (UTC instant). */
export function summarySince(now: Date): Date {
  return new Date(now.getTime() - SUMMARY_WINDOW_DAYS * DAY_MS);
}

/**
 * What the summary may know of one help session: ids, status, the rungs of the hints and whether the
 * comprehension question was answered. No task text, answer, reply or AI text ever reaches it.
 */
export interface SessionLearningRecord {
  readonly assignmentId: string | null;
  readonly competencyCode: string | null;
  readonly openTopicLabel: string | null;
  readonly status: HelpSessionStatus;
  readonly startedAt: Date;
  readonly hintLevels: readonly HintLevel[];
  readonly comprehensionAnswered: boolean;
}

/** Names for a session's topic, resolved by the modules that own them. */
export interface TopicNames {
  /** Assignment id -> the teacher's title. */
  readonly assignmentTitles: ReadonlyMap<string, string>;
  /** Competency code -> the curriculum's text. */
  readonly competencyTexts: ReadonlyMap<string, string>;
}

/** One line of the summary. `label` is `null` for the child's own task without a topic. */
export interface SessionSummary {
  readonly startedAt: Date;
  readonly label: string | null;
  readonly status: HelpSessionStatus;
  readonly hintCount: number;
  readonly highestHintLevel: HintLevel | null;
  readonly comprehensionAnswered: boolean;
}

export interface LearningSummary {
  readonly sessions: readonly SessionSummary[];
  /** Topics with at least `MANY_HINTS` hints or a similar example; `null` is the own task. */
  readonly neededManyHints: readonly (string | null)[];
  /** Topics finished with the comprehension question answered. */
  readonly understood: readonly (string | null)[];
}

function shortLabel(text: string): string {
  const trimmed = text.trim().replace(/\s+/gu, ' ');
  return trimmed.length <= LABEL_MAX_LENGTH
    ? trimmed
    : `${trimmed.slice(0, LABEL_MAX_LENGTH - 1).trimEnd()}…`;
}

/** The teacher's title, else the curriculum competency, else the open topic, else none. */
export function topicLabel(record: SessionLearningRecord, names: TopicNames): string | null {
  const title =
    record.assignmentId === null ? undefined : names.assignmentTitles.get(record.assignmentId);
  const competency =
    record.competencyCode === null ? undefined : names.competencyTexts.get(record.competencyCode);
  const label = title ?? competency ?? record.openTopicLabel;
  return label === null || label.trim() === '' ? null : shortLabel(label);
}

/** The highest rung of the ladder the hints reached, or `null` without a hint. */
export function highestHintLevel(levels: readonly HintLevel[]): HintLevel | null {
  let highest = -1;
  for (const level of levels) {
    highest = Math.max(highest, HINT_LEVELS.indexOf(level));
  }
  return highest < 0 ? null : (HINT_LEVELS[highest] ?? null);
}

function neededManyHints(session: SessionSummary): boolean {
  return session.hintCount >= MANY_HINTS || session.highestHintLevel === 'similar_example';
}

function isUnderstood(session: SessionSummary): boolean {
  return session.status === 'completed' && session.comprehensionAnswered;
}

function distinctLabels(sessions: readonly SessionSummary[]): (string | null)[] {
  return [...new Set(sessions.map(({ label }) => label))];
}

/**
 * The parent's short summary (#35): the latest sessions, newest first, and two neutral lines. No score,
 * no comparison, nothing that counts against the child.
 */
export function summarizeLearning(
  records: readonly SessionLearningRecord[],
  names: TopicNames,
): LearningSummary {
  const sessions = [...records]
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, SUMMARY_SESSION_LIMIT)
    .map((record): SessionSummary => ({
      startedAt: record.startedAt,
      label: topicLabel(record, names),
      status: record.status,
      hintCount: record.hintLevels.length,
      highestHintLevel: highestHintLevel(record.hintLevels),
      comprehensionAnswered: record.comprehensionAnswered,
    }));
  return {
    sessions,
    neededManyHints: distinctLabels(sessions.filter(neededManyHints)),
    understood: distinctLabels(sessions.filter(isUnderstood)),
  };
}
