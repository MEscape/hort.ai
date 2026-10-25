import type { BoredomLevel, CompanionMood } from '../../domain/models/companion-mood';

export interface DailyRewardView {
  readonly status: 'available' | 'claimed';
  readonly xp: number;
  /** The Berlin calendar day the status is about, `YYYY-MM-DD`. */
  readonly dayKey: string;
}

/** A child's progress as the child's parent's screens need it. Derived from the stored rewards. */
export interface ProgressView {
  readonly childProfileId: string;
  readonly xp: number;
  readonly level: number;
  readonly maxLevel: number;
  readonly xpIntoLevel: number;
  /** The size of the current level in XP, `null` at the top level. `xpIntoLevel / xpForNextLevel` is `fraction`. */
  readonly xpForNextLevel: number | null;
  readonly fraction: number;
  readonly dailyReward: DailyRewardView;
  readonly mood: CompanionMood;
  /** 0 (lively) to 4 (very bored); how the face looks, never a score. */
  readonly boredomLevel: BoredomLevel;
  readonly daysAway: number;
  readonly lastActivityAt: Date | null;
}

export interface ClaimDailyRewardView {
  readonly outcome: 'granted' | 'already_claimed';
  /** Whether THIS call moved the child up a level. `false` for `already_claimed`. */
  readonly leveledUp: boolean;
  readonly progress: ProgressView;
}

export interface AwardLearningXpView {
  readonly outcome: 'granted' | 'duplicate';
  readonly leveledUp: boolean;
  readonly progress: ProgressView;
}
