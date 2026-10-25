import { companionMoodOf } from '../domain/models/companion-mood';
import { dayKeyOf } from '../domain/models/day';
import { MAX_LEVEL, levelOf } from '../domain/models/level';
import { DAILY_REWARD_XP } from '../domain/models/xp-rules';

import type { ProgressView } from './contracts/progression-views';
import type { ChildProfileId } from '../domain/models/ids';
import type { ProgressSummary } from '../domain/models/progress';

/** Everything the view derives from the stored rewards and the time it is read at. */
export function toProgressView(
  childProfileId: ChildProfileId,
  summary: ProgressSummary,
  now: Date,
): ProgressView {
  const { lastEventAt, totalXp, dailyRewardClaimed } = summary;
  return {
    childProfileId,
    xp: totalXp,
    maxLevel: MAX_LEVEL,
    ...levelOf(totalXp),
    dailyReward: {
      status: dailyRewardClaimed ? 'claimed' : 'available',
      xp: DAILY_REWARD_XP,
      dayKey: dayKeyOf(now),
    },
    ...companionMoodOf({ lastEventAt, now }),
    lastActivityAt: lastEventAt,
  };
}
