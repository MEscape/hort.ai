import { computeScreenTime, getLearnerQueries, learningDayStart } from '@modules/learner';

import type { Clock } from '@lib/clock';

import { toChildProfileId } from '../../domain/models/ids';

import type { ChildProfileAccess } from '../../domain/ports/child-profile-access.port';

/**
 * Asks the learner module, which loads the profile in the actor's tenant and checks that the
 * actor is its guardian (`learner.read`). Only the id, state, grade and the two time controls cross
 * back; the rest of the profile stays there. "Today" and a closed day are the learner module's own
 * rules (`learningDayStart`, `computeScreenTime`) on `clock`, the server's, so Home and the use
 * cases agree.
 */
export function learnerChildProfileAccess(clock: Clock): ChildProfileAccess {
  return {
    findOwn: (id) =>
      getLearnerQueries()
        .getChildProfileById.execute(id)
        .map((profile) => ({
          id: toChildProfileId(profile.id),
          federalState: profile.federalState,
          grade: profile.grade,
          controls: {
            dailyLimitMinutes: profile.controls.dailyLimitMinutes,
            allowedWindow: profile.controls.allowedWindow,
          },
        })),
    today: () => {
      const now = clock.now();
      return { from: learningDayStart(now), to: now };
    },
    isDayClosed: (child, usedMinutes) =>
      computeScreenTime({
        controls: child.controls,
        usedMinutes,
        now: clock.now(),
      }).status.startsWith('closed'),
  };
}
