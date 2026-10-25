import { range } from '@lib/utils';

import { LEARNER_LIMITS } from '../../application/contracts/learner-constraints';

const MINUTES_PER_HOUR = 60;
const STEP_MINUTES = 30;
const SLOTS_PER_DAY = LEARNER_LIMITS.dayMinutes / STEP_MINUTES;

/** 900 -> "15:00": minutes since midnight as a clock time (1440 reads "24:00", the end of the day). */
export function formatMinute(minute: number): string {
  const hours = Math.floor(minute / MINUTES_PER_HOUR);
  const rest = minute % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

const option = (slot: number) => {
  const minute = slot * STEP_MINUTES;
  return { value: String(minute), label: formatMinute(minute) };
};

/** A window starts at midnight or later and must leave room to end: every half hour but the last. */
export const FROM_OPTIONS = range(0, SLOTS_PER_DAY).map(option);

/** It ends after it starts: every half hour from 00:30 to the end of the day. */
export const UNTIL_OPTIONS = range(1, SLOTS_PER_DAY + 1).map(option);
