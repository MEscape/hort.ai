import { auditedActor } from '@modules/auth';

import type { AppResultAsync } from '@lib/result';

import { dayKeyOf } from '../../domain/models/day';
import { DAILY_REWARD_XP, dailyEventKey } from '../../domain/models/xp-rules';
import { grantXp } from '../services/grant-xp';
import { loadAuthorizedChild } from '../services/load-authorized-child';

import type { ClaimDailyRewardInput } from '../contracts/progression-inputs';
import type { ClaimDailyRewardView } from '../contracts/progression-views';
import type { ProgressionDependencies } from '../progression-dependencies';
import type { LoadChildError } from '../services/load-authorized-child';

export type ClaimDailyRewardError = LoadChildError;

/**
 * Claims today's reward (a Berlin calendar day) for the signed-in parent's own child. One insert
 * under the key `daily:<day>`, guarded by the unique (child, key) index: the second claim of a day,
 * also a concurrent one, stores nothing and answers `already_claimed` with the unchanged progress.
 * The amount is fixed by the rules, never by the request. Audited only when something was stored.
 */
export class ClaimDailyReward {
  constructor(private readonly deps: ProgressionDependencies) {}

  execute(
    input: ClaimDailyRewardInput,
  ): AppResultAsync<ClaimDailyRewardView, ClaimDailyRewardError> {
    const { audit, clock } = this.deps;

    return loadAuthorizedChild(this.deps, input.childProfileId, 'progression.daily_reward').andThen(
      ({ actor, childProfileId }) => {
        const now = clock.now();
        return grantXp(
          this.deps,
          { actor, childProfileId, now },
          { kind: 'daily_reward', eventKey: dailyEventKey(dayKeyOf(now)), xp: DAILY_REWARD_XP },
        ).map(({ stored, leveledUp, progress }): ClaimDailyRewardView => {
          if (stored) {
            audit.record({
              type: 'progression.daily_reward_claimed',
              ...auditedActor(actor),
              tenantId: actor.tenantId,
              childProfileId,
              xp: DAILY_REWARD_XP,
              level: progress.level,
            });
          }
          return { outcome: stored ? 'granted' : 'already_claimed', leveledUp, progress };
        });
      },
    );
  }
}
