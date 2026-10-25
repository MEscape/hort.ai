import { LEARNER_TIME_ZONE } from '@modules/learner/client';

import { GUIDANCE_ERROR_CODES } from '../../application/contracts/guidance-constraints';

const MS_PER_SECOND = 1000;

/**
 * Why the companion is resting (#88), shaped for one calm sentence: when it is back (an instant,
 * shown as Berlin time by the note) and whether that is still today or already tomorrow. There is
 * no countdown anywhere.
 */
export interface LearningPause {
  readonly reason: 'window' | 'limit';
  /** Epoch milliseconds of the next possible start. */
  readonly opensAtMs: number;
  readonly day: 'today' | 'tomorrow';
  /** The next opening is the first minute of the day: no particular time worth naming. */
  readonly anyTime: boolean;
}

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: LEARNER_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const clockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: LEARNER_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * The pause behind a refused start or step, or `null` for any other failure. The backend says how
 * long to wait; the opening time is that long from now on this device's clock, shown in Berlin time.
 * Call it when the action result arrives, not while rendering.
 */
export function learningPauseOf(
  error: { readonly code: string; readonly retryAfterSeconds?: number } | undefined,
  now: Date = new Date(),
): LearningPause | null {
  if (
    error === undefined ||
    error.retryAfterSeconds === undefined ||
    (error.code !== GUIDANCE_ERROR_CODES.learningWindowClosed &&
      error.code !== GUIDANCE_ERROR_CODES.dailyLimitReached)
  ) {
    return null;
  }
  const opensAt = new Date(now.getTime() + error.retryAfterSeconds * MS_PER_SECOND);
  return {
    reason: error.code === GUIDANCE_ERROR_CODES.learningWindowClosed ? 'window' : 'limit',
    opensAtMs: opensAt.getTime(),
    day: dayFormat.format(opensAt) === dayFormat.format(now) ? 'today' : 'tomorrow',
    anyTime: clockFormat.format(opensAt) === '00:00',
  };
}

/** The opening time as the parent's clock shows it, e.g. `14:00`. */
export function openingTime(pause: LearningPause): string {
  return clockFormat.format(new Date(pause.opensAtMs));
}
