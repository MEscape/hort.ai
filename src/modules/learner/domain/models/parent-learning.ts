import type { ParentTaskId } from './ids';

/** The hint ladder in its order: each rung is more help than the one before (vision, step 3). */
export const PARENT_HINT_LEVELS = [
  'UNDERSTAND_TASK',
  'ACTIVATE_PRIOR_KNOWLEDGE',
  'NEXT_STEP',
  'SIMILAR_EXAMPLE',
] as const;
export type ParentHintLevel = (typeof PARENT_HINT_LEVELS)[number];

/** The allowlisted results of an answer check; "not yet" leads back to hints, never to a grade. */
export const PARENT_ANSWER_RESULTS = ['CORRECT', 'PARTLY_CORRECT', 'NOT_YET'] as const;
export type ParentAnswerResult = (typeof PARENT_ANSWER_RESULTS)[number];

/** The child's own answers in one task and how each was checked. Unchecked answers count only in `given`. */
export interface ParentAnswerEvidence {
  readonly given: number;
  readonly results: Readonly<Record<ParentAnswerResult, number>>;
}

export const PARENT_SUBJECTS = ['MATH', 'GERMAN', 'GENERAL_STUDIES', 'ENGLISH'] as const;
export type ParentSubject = (typeof PARENT_SUBJECTS)[number];

/**
 * The curriculum competency a task was classified under at its start, as the official document
 * words it (German source text). Exposure to a topic is not evidence of mastery. The curriculum
 * module describes it; the app route looks it up by the task's `competencyCode`.
 */
export interface ParentTopic {
  readonly section: string | null;
  readonly statement: string;
}

/** Topics by curriculum view code, as the app route resolved them for the tasks shown. */
export type ParentTopics = Readonly<Record<string, ParentTopic>>;

/** Minimized parent projection: no task text, answers, hint text, recordings or safety disclosures. */
export interface ParentTask {
  readonly id: ParentTaskId;
  readonly assignmentId: string | null;
  readonly status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly endedAt: string | null;
  readonly subject: ParentSubject;
  /**
   * The curriculum view code the task was classified under; `null` when it was not classified, or
   * only under an open label, which is derived from the child's own text and stays private.
   */
  readonly competencyCode: string | null;
  readonly hintCount: number | null;
  /** The rungs of the hint ladder used, in ladder order; empty when none or when hints are unknown. */
  readonly hintLevels: readonly ParentHintLevel[];
  readonly answers: ParentAnswerEvidence | null;
  readonly questionsAsked: number | null;
  readonly questionsAnswered: number | null;
  readonly evidencePartial?: boolean;
}

/** An assignment visible through the child's current active class, without its solution key. */
export interface ParentAssignment {
  readonly id: string;
  readonly title: string;
  readonly subject: ParentSubject;
  readonly dueDate: string | null;
  readonly started: boolean;
  readonly completed: boolean;
  readonly progressPartial?: boolean;
}

/** One task with the assignment it belongs to, if any: the detail page names it by its title. */
export interface ParentTaskWithAssignment extends ParentTask {
  readonly assignment: Pick<ParentAssignment, 'title' | 'subject'> | null;
}

export interface ParentLearningRecords {
  readonly tasks: readonly ParentTask[];
  readonly assignments: readonly ParentAssignment[];
  readonly tasksTruncated: boolean;
  readonly assignmentsTruncated: boolean;
}
