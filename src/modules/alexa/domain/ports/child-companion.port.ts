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

/**
 * The child-app operations the voice channel may use, for the ONE child the channel is bound to by
 * server configuration. No method takes a child id: nothing in a request can name another child.
 * Implemented by an adapter onto the learner, progression, classroom and assignments use cases, which
 * authorize every call themselves.
 */
export interface ChildCompanion {
  /** The child's own companion (as in `ChildHome.tutorId`), for the voice of a reply. */
  companion(): AppResultAsync<TutorId | null>;
  home(): AppResultAsync<ChildHome>;
  feed(): AppResultAsync<FeedResult>;
  level(): AppResultAsync<LevelStatus>;
  tasks(): AppResultAsync<ChildTasks>;
}
