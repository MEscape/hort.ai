import type { CompanionMood } from '@modules/progression';

import type { AppResultAsync } from '@lib/result';

import type { TutorId } from '../models/ids';

/** What the companion knows when the skill opens. Read from the backend each time, never stored. */
export interface ChildHome {
  /** The child's own companion; `null` when none is chosen or it is not a ready catalog tutor. */
  readonly tutorId: TutorId | null;
  /** The guardian's learning window allows learning now. */
  readonly learningAllowed: boolean;
  readonly rewardAvailable: boolean;
  readonly mood: CompanionMood;
  /** How many teacher assignments the child's class has (0 without a class). */
  readonly openTasks: number;
}

export interface FeedResult {
  readonly outcome: 'granted' | 'already_claimed';
  /** Stars (XP) the daily reward gives. */
  readonly stars: number;
  readonly leveledUp: boolean;
  readonly level: number;
}

export interface LevelStatus {
  readonly level: number;
  /** Stars still missing for the next level; `null` on the highest level. */
  readonly starsToNext: number | null;
}

export interface ChildTasks {
  readonly inClass: boolean;
  /** Titles of the class's assignments as the child sees them (never a solution key). */
  readonly titles: readonly string[];
}

/** Opaque references handed out by the guidance module and only given back to it. */
export type StoredRef = string;
export type RetryRef = string;

/** Where the child's open help session stands (an understood one counts as none). */
export interface OpenHelp {
  /** Opaque id of the stored session; only handed back to this port. */
  readonly sessionId: StoredRef;
  readonly status: 'working' | 'awaiting_comprehension_reply';
  /** The task as stored (the child's own words or the teacher's text, never a solution key). */
  readonly task: string;
}

/**
 * Which stored message of the help session a text is, so the voice module can find its words on the
 * server again and speak them in the companion's voice (never words from the request).
 */
export type TutorMessage = 'latest_hint' | 'latest_feedback' | 'question' | 'opening';

/** One text of the companion: validated by guidance, or its predefined catalog wording. */
export interface TutorText {
  readonly text: string;
  readonly message: TutorMessage;
}

/** A new task: the child's own words, or the teacher's assignment at a spoken position (1 = first). */
export type NewTask =
  | { readonly kind: 'own'; readonly text: string }
  | { readonly kind: 'assignment'; readonly position: number };

export interface AnswerChecked {
  readonly correct: boolean;
  /** Correct: praise and the comprehension question. Otherwise one encouraging message. */
  readonly says: readonly TutorText[];
}

/**
 * The help session of the web (guidance), for the bound child. The session lives in the backend; the
 * channel keeps no learning state and never decides a level, a result or a solution itself.
 * `requestId` makes a step retryable: the same id gives the same stored step instead of a new one.
 */
export interface ChildLearning {
  openHelp(): AppResultAsync<OpenHelp | null>;
  /** Starts (or continues) the session and says its opening or first hint. */
  startHelp(task: NewTask, requestId: RetryRef): AppResultAsync<TutorText>;
  nextHint(sessionId: StoredRef, requestId: RetryRef): AppResultAsync<TutorText>;
  checkAnswer(sessionId: StoredRef, requestId: RetryRef, answer: string): AppResultAsync<AnswerChecked>;
  replyToQuestion(
    sessionId: StoredRef,
    reply: string,
  ): AppResultAsync<{ readonly understood: boolean }>;
  /** A short-lived clip URL of `message` in the child's companion voice (a bearer link: never log it). */
  tutorVoice(message: TutorMessage): AppResultAsync<string>;
}

/**
 * The child-app operations the voice channel may use, for the ONE child the channel is bound to by
 * server configuration. No method takes a child id: nothing in a request can name another child.
 * Implemented by an adapter onto the learner, progression, classroom and assignments use cases, which
 * authorize every call themselves.
 */
export interface ChildCompanion extends ChildLearning {
  /** The child's own companion (as in `ChildHome.tutorId`), for the voice of a reply. */
  companion(): AppResultAsync<TutorId | null>;
  home(): AppResultAsync<ChildHome>;
  feed(): AppResultAsync<FeedResult>;
  level(): AppResultAsync<LevelStatus>;
  tasks(): AppResultAsync<ChildTasks>;
}
