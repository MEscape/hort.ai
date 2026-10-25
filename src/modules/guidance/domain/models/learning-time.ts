import { MS_PER_MINUTE, SECONDS_PER_HOUR } from '@lib/utils';

const IDLE_CAP_MINUTES = 5;
/**
 * A pause between two stored steps counts only up to this long: a child who put the tablet down
 * for an hour did not learn for an hour.
 */
export const IDLE_CAP_MS = IDLE_CAP_MINUTES * MS_PER_MINUTE;

const LONGEST_DAY_HOURS = 25;
const SLACK_HOURS = 1;
/** How far back to read stored steps to cover the whole Berlin calendar day (at most 25 hours). */
export const LEARNING_LOOKBACK_MS = (LONGEST_DAY_HOURS + SLACK_HOURS) * SECONDS_PER_HOUR * 1000;

/**
 * The minutes the child worked with the companion today (Berlin calendar day), counted from the
 * instants the backend stored for session starts, hints, answers and replies, never from a client.
 * `calendarDay` names the calendar day of an instant for the parent's time zone (the learner module's rule).
 *
 * Each step counts the time up to the next one, capped at `IDLE_CAP_MS`, and belongs to the day it
 * began in. Steps at the same instant count once. The last step adds nothing, because how long the
 * child stayed after it is not known. Time is added up on the absolute timeline, so the 25-hour day
 * of a clock change is counted correctly. Whole minutes, rounded down.
 */
export function countLearningMinutes(
  instants: readonly Date[],
  now: Date,
  calendarDay: (instant: Date) => string,
): number {
  const today = calendarDay(now);
  const times = instants
    .map((instant) => instant.getTime())
    .filter((time) => time <= now.getTime())
    .sort((a, b) => a - b);
  let counted = 0;
  times.slice(1).forEach((time, index) => {
    const begin = times[index] ?? time;
    if (calendarDay(new Date(begin)) === today) {
      counted += Math.min(time - begin, IDLE_CAP_MS);
    }
  });
  return Math.floor(counted / MS_PER_MINUTE);
}
