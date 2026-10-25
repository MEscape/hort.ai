import { MS_PER_MINUTE, isDefined } from '@lib/utils';

import { LEARNER_LIMITS } from './learner-limits';
import { berlinDay, minutesSinceMidnight } from './parent-controls';

import type { AllowedWindow } from './parent-controls';

/** From this many minutes left the child gets a gentle heads-up. */
export const LOW_TIME_MINUTES = 5;

export type ScreenTimeStatus = 'open' | 'low' | 'closed_limit_reached' | 'closed_outside_window';

/**
 * What is known about the day's usage. `unavailable` is a daily limit nobody can count against
 * yet (usage is not measured): it is never shown as "unlimited".
 */
export type ScreenTimeUsage =
  | { readonly kind: 'unlimited'; readonly usedMinutes: number | null }
  | {
      readonly kind: 'limited';
      readonly limitMinutes: number;
      readonly usedMinutes: number;
      readonly remainingMinutes: number;
    }
  | { readonly kind: 'unavailable'; readonly limitMinutes: number };

export interface ScreenTime {
  readonly status: ScreenTimeStatus;
  readonly usage: ScreenTimeUsage;
  /** Minutes until the limit or the end of the window, whichever comes first; `null` if neither can be told. */
  readonly minutesLeft: number | null;
  /** When the allowed window next opens, only while it is closed. */
  readonly reopensAt: Date | null;
}

interface ScreenTimeInput {
  readonly controls: {
    readonly dailyLimitMinutes: number | null;
    readonly allowedWindow: AllowedWindow | null;
  };
  /** Minutes learned today, or `null` while nothing measures them. */
  readonly usedMinutes: number | null;
  /** The server's clock, never the device's. */
  readonly now: Date;
}

function usageOf({ controls, usedMinutes }: ScreenTimeInput): ScreenTimeUsage {
  const limit = controls.dailyLimitMinutes;
  if (limit === null) {
    return { kind: 'unlimited', usedMinutes };
  }
  if (usedMinutes === null) {
    return { kind: 'unavailable', limitMinutes: limit };
  }
  return {
    kind: 'limited',
    limitMinutes: limit,
    usedMinutes,
    remainingMinutes: Math.max(0, limit - usedMinutes),
  };
}

/**
 * Where the child's day stands against what the parent set: the limit and the allowed window. A
 * pure function of the server's clock, so the enforcing use cases and the screen agree. The window
 * is `[from, until)` on the clock of `LEARNER_TIME_ZONE`; outside it wins over the limit, because
 * "Lili is sleeping until 3 pm" is the more useful thing to say.
 */
export function computeScreenTime(input: ScreenTimeInput): ScreenTime {
  const { controls, now } = input;
  const usage = usageOf(input);
  const minute = minutesSinceMidnight(now);
  const window = controls.allowedWindow;

  if (window !== null && (minute < window.fromMinute || minute >= window.untilMinute)) {
    return {
      status: 'closed_outside_window',
      usage,
      minutesLeft: 0,
      reopensAt: firstOpenInstant(window, now, () => true),
    };
  }

  if (usage.kind === 'limited' && usage.remainingMinutes === 0) {
    return { status: 'closed_limit_reached', usage, minutesLeft: 0, reopensAt: null };
  }

  const left = [
    usage.kind === 'limited' ? usage.remainingMinutes : null,
    window === null ? null : window.untilMinute - minute,
  ].filter(isDefined);
  const minutesLeft = left.length === 0 ? null : Math.min(...left);
  const isLow = minutesLeft !== null && minutesLeft <= LOW_TIME_MINUTES;

  return { status: isLow ? 'low' : 'open', usage, minutesLeft, reopensAt: null };
}

const SEARCH_STEP_MS = LEARNER_LIMITS.windowStepMinutes * MS_PER_MINUTE;
/** Two days of search steps: the longest Berlin day is 25 hours, so the next opening is always inside. */
const SEARCH_STEPS = (2 * LEARNER_LIMITS.dayMinutes) / LEARNER_LIMITS.windowStepMinutes;

const isInWindow = (window: AllowedWindow | null, instant: Date) => {
  const minute = minutesSinceMidnight(instant);
  return window === null || (minute >= window.fromMinute && minute < window.untilMinute);
};

/**
 * The first instant after `now` that lies inside `window` (any instant without one) and passes
 * `accepts`. The window is read as Berlin clock time, so this follows the real timeline through a
 * clock change: a swallowed hour opens at the first existing minute, a repeated hour at its first pass.
 * Window edges are multiples of the step (`isValidWindow`), so stepping by it finds them exactly.
 */
function firstOpenInstant(
  window: AllowedWindow | null,
  now: Date,
  accepts: (instant: Date) => boolean,
): Date {
  const first = now.getTime() - (now.getTime() % SEARCH_STEP_MS) + SEARCH_STEP_MS;
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const instant = new Date(first + step * SEARCH_STEP_MS);
    if (isInWindow(window, instant) && accepts(instant)) {
      return instant;
    }
  }
  // Unreachable for a valid window; the end of the search is a safe, late answer.
  return new Date(first + SEARCH_STEPS * SEARCH_STEP_MS);
}

/**
 * When the child may learn again after a day's limit is used up: the first moment of the next
 * Berlin calendar day that the allowed window permits (the start of the day without a window).
 */
export function nextDayOpening(controls: ScreenTimeInput['controls'], now: Date): Date {
  const today = berlinDay(now);
  return firstOpenInstant(controls.allowedWindow, now, (instant) => berlinDay(instant) !== today);
}
