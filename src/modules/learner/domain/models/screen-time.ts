import { MS_PER_MINUTE, isDefined } from '@lib/utils';

import { LEARNER_LIMITS } from './learner-limits';
import { minutesSinceMidnight } from './parent-controls';
import { parentPeriod } from './parent-period';

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
    // shortcut: whole minutes added to `now`, off by an hour only on the night of a clock change; use a zoned date library if that ever matters.
    const wait =
      (window.fromMinute - minute + (minute < window.fromMinute ? 0 : LEARNER_LIMITS.dayMinutes)) *
      MS_PER_MINUTE;
    return {
      status: 'closed_outside_window',
      usage,
      minutesLeft: 0,
      reopensAt: new Date(now.getTime() - (now.getTime() % MS_PER_MINUTE) + wait),
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

/** Midnight of the child's calendar day at `now` in `LEARNER_TIME_ZONE`: the daily limit counts from here. */
export function learningDayStart(now: Date): Date {
  return new Date(parentPeriod('today', now).from);
}
