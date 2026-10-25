import type {
  ParentAnswerEvidence,
  ParentAnswerResult,
  ParentAssignment,
  ParentHintLevel,
  ParentLearningRecords,
  ParentSubject,
  ParentTask,
  ParentTaskWithAssignment,
  ParentTopic,
  ParentTopics,
} from '../../domain/models/parent-learning';

export {
  PARENT_ANSWER_RESULTS,
  PARENT_HINT_LEVELS,
  PARENT_SUBJECTS,
} from '../../domain/models/parent-learning';
export type ParentRange = 'today' | 'week' | 'month';
export type ParentSection =
  'overview' | 'learning' | 'assignments' | 'time' | 'settings' | 'privacy';
export type {
  ParentAnswerEvidence,
  ParentAnswerResult,
  ParentAssignment,
  ParentHintLevel,
  ParentLearningRecords,
  ParentSubject,
  ParentTask,
  ParentTaskWithAssignment,
  ParentTopic,
  ParentTopics,
};

export interface ParentPeriod {
  readonly range: ParentRange;
  readonly from: string;
  readonly until: string;
  readonly today: string;
  readonly days: readonly string[];
}

/**
 * Counts of recorded facts for one period. Every "of" count has its own denominator: tasks whose
 * evidence is unavailable (notes off or truncated) are left out of it, never counted as zero.
 */
export interface ParentLearningMetrics {
  readonly total: number;
  readonly completed: number;
  readonly active: number;
  readonly abandoned: number;
  readonly hintedTasks: number;
  readonly hintTotal: number;
  /** Tasks with a known hint count: the denominator of every hint metric. */
  readonly insightTasks: number;
  readonly answeredTasks: number;
  /** Tasks whose own answers are known: the denominator of `ownAnswerTasks` and `correctTasks`. */
  readonly answerKnownTasks: number;
  /** Tasks in which the child gave at least one own answer. */
  readonly ownAnswerTasks: number;
  /** Tasks in which at least one own answer was checked as correct. */
  readonly correctTasks: number;
  readonly outcomes: ReadonlyArray<{
    readonly day: string;
    readonly ACTIVE: number;
    readonly COMPLETED: number;
    readonly ABANDONED: number;
  }>;
  readonly subjects: ReadonlyArray<{ readonly subject: ParentSubject; readonly count: number }>;
  readonly hintDistribution: ReadonlyArray<{ readonly hints: number; readonly tasks: number }>;
  /** Per rung of the hint ladder, the tasks that used it; empty when no hint count is known. */
  readonly helpLevels: ReadonlyArray<{ readonly level: ParentHintLevel; readonly tasks: number }>;
}

export interface ParentLearningView {
  readonly records: ParentLearningRecords;
  readonly period: ParentPeriod;
  readonly metrics: ParentLearningMetrics;
  readonly insightsEnabled: boolean;
}
