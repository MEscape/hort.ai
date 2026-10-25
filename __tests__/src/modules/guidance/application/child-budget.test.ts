import { describe, expect, it } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import { GUIDANCE_RATE_LIMITS } from '@modules/guidance/application/rate-limits';
import { spendChildBudget } from '@modules/guidance/application/services/child-budget';
import { toChildProfileId } from '@modules/guidance/domain/models/ids';

import type { RateLimiter, RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_MINUTE } from '@lib/utils';

import { createTestRateLimiter } from '../../../support/rate-limiting';
import { parent } from '../../auth/fakes';

const ACTOR = parent();
const MS_PER_SECOND = 1000;

function movableClock() {
  let now = new Date('2026-10-25T08:00:00.000Z').getTime();
  return {
    clock: { now: () => new Date(now) },
    advanceMinutes: (minutes: number) => {
      now += minutes * SECONDS_PER_MINUTE * MS_PER_SECOND;
    },
  };
}

async function spend(
  rateLimiter: RateLimiter,
  policy: RateLimitPolicy,
  child = 'child-1',
  actor = ACTOR,
) {
  return spendChildBudget(rateLimiter, {
    actor,
    childProfileId: toChildProfileId(child),
    policy,
  });
}

/** Spends `count` attempts, moving past the ten-minute window whenever it is used up. */
async function spendAcrossWindows(
  rateLimiter: RateLimiter,
  time: ReturnType<typeof movableClock>,
  policy: RateLimitPolicy,
  count: number,
) {
  for (let attempt = 0; attempt < count; attempt += 1) {
    if (attempt > 0 && attempt % policy.limit === 0) {
      time.advanceMinutes(11);
    }
    expect((await spend(rateLimiter, policy)).isOk()).toBe(true);
  }
}

describe('spendChildBudget', () => {
  it.each([
    ['hints', GUIDANCE_RATE_LIMITS.hintRequest, GUIDANCE_RATE_LIMITS.hintRequestDaily],
    ['checks', GUIDANCE_RATE_LIMITS.answerCheck, GUIDANCE_RATE_LIMITS.answerCheckDaily],
    ['session starts', GUIDANCE_RATE_LIMITS.sessionStart, GUIDANCE_RATE_LIMITS.sessionStartDaily],
  ])('caps a child’s %s per day, not only per ten minutes', async (_name, policy, daily) => {
    const time = movableClock();
    const rateLimiter = createTestRateLimiter({ clock: time.clock });
    await spendAcrossWindows(rateLimiter, time, policy, daily.limit);
    time.advanceMinutes(11);

    const refused = await spend(rateLimiter, policy);
    const sibling = await spend(rateLimiter, policy, 'child-2');

    expect(refused._unsafeUnwrapErr().kind).toBe('rate_limited');
    expect(sibling.isOk()).toBe(true);
  });

  it('caps all AI calls of all children per hour', async () => {
    const rateLimiter = createTestRateLimiter();
    const { limit } = GUIDANCE_RATE_LIMITS.aiCallsHourly;
    const perChild = GUIDANCE_RATE_LIMITS.hintRequest.limit;
    for (let attempt = 0; attempt < limit; attempt += 1) {
      const group = Math.floor(attempt / perChild);
      // One family per child, so only the global budget is reached.
      const family = parent({ id: toActorId(`parent-${String(group)}`) });
      expect(
        (
          await spend(
            rateLimiter,
            GUIDANCE_RATE_LIMITS.hintRequest,
            `child-${String(group)}`,
            family,
          )
        ).isOk(),
      ).toBe(true);
    }

    const refused = await spend(rateLimiter, GUIDANCE_RATE_LIMITS.sessionStart, 'fresh-child');

    expect(refused._unsafeUnwrapErr().kind).toBe('rate_limited');
  });

  it('caps one account with many child profiles before it reaches the global budget', async () => {
    const rateLimiter = createTestRateLimiter();
    const { limit } = GUIDANCE_RATE_LIMITS.aiCallsPerAccountHourly;
    const perChild = GUIDANCE_RATE_LIMITS.hintRequest.limit;
    for (let attempt = 0; attempt < limit; attempt += 1) {
      const child = `child-${String(Math.floor(attempt / perChild))}`;
      await spend(rateLimiter, GUIDANCE_RATE_LIMITS.hintRequest, child);
    }

    const sameFamily = await spend(rateLimiter, GUIDANCE_RATE_LIMITS.sessionStart, 'child-new');
    const otherFamily = await spend(
      rateLimiter,
      GUIDANCE_RATE_LIMITS.sessionStart,
      'child-x',
      parent({ id: toActorId('parent-other') }),
    );

    expect(sameFamily._unsafeUnwrapErr().kind).toBe('rate_limited');
    expect(otherFamily.isOk()).toBe(true);
  });

  it('does not let a child who is out of budget use up the global one', async () => {
    const rateLimiter = createTestRateLimiter();
    const { limit } = GUIDANCE_RATE_LIMITS.aiCallsHourly;
    for (let attempt = 0; attempt < limit; attempt += 1) {
      await spend(rateLimiter, GUIDANCE_RATE_LIMITS.answerCheck);
    }

    expect((await spend(rateLimiter, GUIDANCE_RATE_LIMITS.answerCheck, 'child-2')).isOk()).toBe(
      true,
    );
  });
});
