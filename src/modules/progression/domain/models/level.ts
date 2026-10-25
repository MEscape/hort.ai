/** Cumulative XP at which level 1..6 starts. Single source of truth for the level curve. */
// eslint-disable-next-line no-magic-numbers -- the thresholds themselves are the definition
export const LEVEL_THRESHOLDS = [0, 20, 50, 90, 140, 200] as const;

export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export interface LevelProgress {
  /** 1..`MAX_LEVEL`. */
  readonly level: number;
  /** XP collected since this level started. */
  readonly xpIntoLevel: number;
  /** The size of the current level in XP (what it takes to reach the next one), `null` at the top. */
  readonly xpForNextLevel: number | null;
  /** `xpIntoLevel / xpForNextLevel`, `1` at the top level. */
  readonly fraction: number;
}

/**
 * Where a total XP puts the child. Pure; XP below zero or with a fraction is treated as the whole
 * non-negative amount it stands for (the ledger never holds either, this keeps the view honest).
 */
export function levelOf(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));
  const index = LEVEL_THRESHOLDS.filter((threshold) => xp >= threshold).length - 1;
  const start = LEVEL_THRESHOLDS[index] ?? 0;
  const next = LEVEL_THRESHOLDS[index + 1];
  const level = index + 1;
  if (next === undefined) {
    return { level, xpIntoLevel: xp - start, xpForNextLevel: null, fraction: 1 };
  }
  const span = next - start;
  return { level, xpIntoLevel: xp - start, xpForNextLevel: span, fraction: (xp - start) / span };
}
