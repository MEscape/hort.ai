import { beforeEach, describe, expect, it, vi } from 'vitest';

import { childNotFound } from '@modules/progression/domain/errors/progression-errors';
import { claimDailyRewardAction } from '@modules/progression/presentation/actions/claim-daily-reward-action';

import { errAsync, okAsync } from '@lib/result';

const commands = vi.hoisted(() => ({ claimDailyReward: { execute: vi.fn() } }));
vi.mock('@modules/progression/composition', () => ({ getProgressionCommands: () => commands }));

const VIEW = {
  outcome: 'granted',
  leveledUp: true,
  progress: {
    childProfileId: 'child-1',
    xp: 20,
    level: 2,
    maxLevel: 6,
    xpIntoLevel: 0,
    xpForNextLevel: 30,
    fraction: 0,
    dailyReward: { status: 'claimed', xp: 5, dayKey: '2026-10-25' },
    mood: 'cheerful',
    boredomLevel: 0,
    daysAway: 0,
    lastActivityAt: new Date('2026-10-25T10:00:00.000Z'),
  },
};

describe('claimDailyRewardAction', () => {
  beforeEach(() => {
    commands.claimDailyReward.execute.mockReset();
  });

  it.each([
    undefined,
    null,
    {},
    { childProfileId: '' },
    { childProfileId: 7 },
    { childProfileId: 'x'.repeat(65) },
  ])('refuses malformed input %j before reaching the use case', async (input) => {
    const result = await claimDailyRewardAction(input);

    expect(result.ok).toBe(false);
    expect(commands.claimDailyReward.execute).not.toHaveBeenCalled();
  });

  it('passes only the child id on: an owner or tenant in the input never reaches the use case', async () => {
    commands.claimDailyReward.execute.mockReturnValue(okAsync(VIEW));

    await claimDailyRewardAction({
      childProfileId: 'child-1',
      ownerId: 'someone-else',
      tenantId: 't',
    });

    expect(commands.claimDailyReward.execute).toHaveBeenCalledWith({ childProfileId: 'child-1' });
  });

  it('answers with plain values: the instant as ISO text', async () => {
    commands.claimDailyReward.execute.mockReturnValue(okAsync(VIEW));

    const result = await claimDailyRewardAction({ childProfileId: 'child-1' });

    expect(result).toEqual({
      ok: true,
      data: {
        outcome: 'granted',
        leveledUp: true,
        progress: { ...VIEW.progress, lastActivityAt: '2026-10-25T10:00:00.000Z' },
      },
    });
  });

  it('reports a failure with its code and never as a success', async () => {
    commands.claimDailyReward.execute.mockReturnValue(errAsync(childNotFound()));

    const result = await claimDailyRewardAction({ childProfileId: 'child-1' });

    expect(result).toMatchObject({ ok: false, error: { code: 'progression.not_found' } });
  });
});
