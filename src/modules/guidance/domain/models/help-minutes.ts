import { MS_PER_MINUTE } from '@lib/utils';

/** A longer pause between two steps counts only this much, so an idle open tab is not help time. */
const MAX_GAP_MINUTES = 5;

/**
 * Minutes of help from the step times of each session: one minute for a session's first step plus
 * every gap to its next step, each capped at five minutes, rounded up to whole minutes in total.
 */
export function helpMinutes(sessions: ReadonlyArray<readonly Date[]>): number {
  let total = 0;
  for (const steps of sessions) {
    const times = steps.map((step) => step.getTime()).sort((a, b) => a - b);
    times.forEach((time, index) => {
      const previous = times[index - 1];
      total +=
        previous === undefined
          ? MS_PER_MINUTE
          : Math.min(time - previous, MAX_GAP_MINUTES * MS_PER_MINUTE);
    });
  }
  return Math.ceil(total / MS_PER_MINUTE);
}
