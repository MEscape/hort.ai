import { MS_PER_DAY } from '@lib/utils';

/** The calendar a "day" is read in for the daily reward and the companion's mood. */
export const PROGRESSION_TIME_ZONE = 'Europe/Berlin';

/** A calendar day as `YYYY-MM-DD`. */
export type DayKey = string;

const dayParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: PROGRESSION_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The Berlin calendar day an instant falls on. Reads the zone's own rules, so the 25 hour and 23
 * hour days of the daylight saving changes are handled by the platform, not by arithmetic here.
 */
export function dayKeyOf(instant: Date): DayKey {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    dayParts.formatToParts(instant).find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const utcMidnight = (dayKey: DayKey) => Date.parse(`${dayKey}T00:00:00Z`);

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). Zone-free: both are day keys. */
export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / MS_PER_DAY);
}
