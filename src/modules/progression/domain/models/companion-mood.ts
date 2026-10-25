import { dayKeyOf, daysBetween } from './day';

export type CompanionMood = 'new' | 'cheerful' | 'calm' | 'sleepy' | 'bored';

/** How bored the companion looks, 0 (lively) to 4 (very bored). Drives the face, never any score. */
// eslint-disable-next-line no-magic-numbers -- a closed set of five levels
export type BoredomLevel = 0 | 1 | 2 | 3 | 4;

export interface CompanionMoodView {
  readonly mood: CompanionMood;
  readonly boredomLevel: BoredomLevel;
  readonly daysAway: number;
}

const MAX_BOREDOM: BoredomLevel = 4;
/** Calendar days away -> mood; from `MAX_BOREDOM` days on it stays the same, nothing gets worse. */
const MOOD_BY_DAYS = ['cheerful', 'calm', 'sleepy', 'bored', 'bored'] as const;

/**
 * How the companion looks, DERIVED from the last stored event and never stored itself, so it can
 * not contradict the events. Calendar days in Berlin, not 24 hour spans. None of the moods is a
 * judgement: a missed day only makes the companion sleepier or bored, it takes nothing away, and
 * one feeding makes it cheerful again at once.
 */
export function companionMoodOf(input: {
  readonly lastEventAt: Date | null;
  readonly now: Date;
}): CompanionMoodView {
  if (input.lastEventAt === null) {
    return { mood: 'new', boredomLevel: 0, daysAway: 0 };
  }
  const daysAway = Math.max(0, daysBetween(dayKeyOf(input.lastEventAt), dayKeyOf(input.now)));
  const boredomLevel = Math.min(daysAway, MAX_BOREDOM) as BoredomLevel;
  return { mood: MOOD_BY_DAYS[boredomLevel], boredomLevel, daysAway };
}
