import type { ScreenTime } from '@modules/learner/client';

import type { StripTime } from '@components/shared/status-strip';

/**
 * Product's one switch for a closed day (limit reached, or outside the allowed hours): when true,
 * the child can still feed the companion and look at their world, and only new tasks and photos
 * are paused. Set it to false to make a closed day lock those two as well.
 */
export const CLOSED_KEEPS_COMPANION_AND_WORLD = true;

export interface ClosedReason {
  readonly reason: 'limit' | 'window';
  readonly reopensAt: Date | null;
}

/** Why new tasks are paused, or `null` while the child may start one. */
export function closedReasonOf(time: ScreenTime): ClosedReason | null {
  if (time.status === 'closed_limit_reached') {
    return { reason: 'limit', reopensAt: null };
  }
  return time.status === 'closed_outside_window'
    ? { reason: 'window', reopensAt: time.reopensAt }
    : null;
}

/** What the strip says about the time. An uncounted limit is "not available", never "unlimited". */
export function stripTimeOf(time: ScreenTime): StripTime {
  const closed = closedReasonOf(time);
  if (closed !== null) {
    return { kind: 'closed', ...closed };
  }
  const { usage, minutesLeft } = time;
  const isLow = time.status === 'low';
  if (usage.kind === 'unavailable' && !isLow) {
    return { kind: 'unavailable' };
  }
  if (minutesLeft !== null) {
    return {
      kind: 'left',
      minutes: minutesLeft,
      fraction: usage.kind === 'limited' ? usage.remainingMinutes / usage.limitMinutes : null,
      isLow,
    };
  }
  return usage.kind === 'unlimited' && usage.usedMinutes !== null
    ? { kind: 'learned', minutes: usage.usedMinutes }
    : { kind: 'hidden' };
}
