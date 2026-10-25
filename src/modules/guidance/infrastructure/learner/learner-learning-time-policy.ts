import { berlinDay, computeScreenTime, nextDayOpening } from '@modules/learner';

import type { LearningTimePolicy } from '../../domain/ports/learning-time-policy.port';

/** Asks the learner module, which owns the parent's controls and the rule for reading them. */
export const learnerLearningTimePolicy: LearningTimePolicy = {
  calendarDay: berlinDay,
  assess: (controls, usedMinutes, now) => {
    const { status, reopensAt } = computeScreenTime({ controls, usedMinutes, now });
    if (status === 'closed_outside_window') {
      return { status: 'window_closed', reopensAt };
    }
    return status === 'closed_limit_reached'
      ? { status: 'limit_reached', reopensAt: nextDayOpening(controls, now) }
      : { status: 'open', reopensAt: null };
  },
};
