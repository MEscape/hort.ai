import type {
  ClaimDailyRewardView,
  ProgressView,
} from '../../application/contracts/progression-views';

export type CompanionMood = ProgressView['mood'];
export type BoredomLevel = ProgressView['boredomLevel'];

/** What the browser gets of a child's progress: plain values only, the instant as ISO text. */
export interface ProgressDto {
  readonly childProfileId: string;
  readonly xp: number;
  readonly level: number;
  readonly maxLevel: number;
  readonly xpIntoLevel: number;
  /** The size of the current level in XP (`xpIntoLevel / xpForNextLevel` is `fraction`); `null` at the top level. */
  readonly xpForNextLevel: number | null;
  readonly fraction: number;
  readonly dailyReward: {
    readonly status: 'available' | 'claimed';
    readonly xp: number;
    /** The Berlin calendar day, `YYYY-MM-DD`. */
    readonly dayKey: string;
  };
  readonly mood: CompanionMood;
  readonly boredomLevel: BoredomLevel;
  readonly daysAway: number;
  readonly lastActivityAt: string | null;
}

export interface ClaimDailyRewardDto {
  readonly outcome: 'granted' | 'already_claimed';
  /** Whether this very claim moved the child up a level. */
  readonly leveledUp: boolean;
  readonly progress: ProgressDto;
}

export function toProgressDto(view: ProgressView): ProgressDto {
  return {
    childProfileId: view.childProfileId,
    xp: view.xp,
    level: view.level,
    maxLevel: view.maxLevel,
    xpIntoLevel: view.xpIntoLevel,
    xpForNextLevel: view.xpForNextLevel,
    fraction: view.fraction,
    dailyReward: view.dailyReward,
    mood: view.mood,
    boredomLevel: view.boredomLevel,
    daysAway: view.daysAway,
    lastActivityAt: view.lastActivityAt === null ? null : view.lastActivityAt.toISOString(),
  };
}

export function toClaimDailyRewardDto(view: ClaimDailyRewardView): ClaimDailyRewardDto {
  return {
    outcome: view.outcome,
    leveledUp: view.leveledUp,
    progress: toProgressDto(view.progress),
  };
}
