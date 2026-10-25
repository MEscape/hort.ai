import { describe, expect, it } from 'vitest';

import { ClaimDailyReward } from '@modules/progression/application/commands/claim-daily-reward';

import { PARENT_A, PARENT_B, build, storedEvent } from '../fakes';

const CHILD = { childProfileId: 'child-1' };

describe('ClaimDailyReward', () => {
  it('stores the fixed daily amount under the Berlin day key and confirms it', async () => {
    const { deps, progress } = build();

    const view = (await new ClaimDailyReward(deps).execute(CHILD))._unsafeUnwrap();

    expect(view).toMatchObject({
      outcome: 'granted',
      leveledUp: false,
      progress: {
        childProfileId: 'child-1',
        xp: 5,
        level: 1,
        mood: 'cheerful',
        boredomLevel: 0,
        dailyReward: { status: 'claimed', xp: 5, dayKey: '2026-10-25' },
      },
    });
    expect(progress.rows).toEqual([
      {
        tenantId: PARENT_A.tenantId,
        ownerId: PARENT_A.id,
        childProfileId: 'child-1',
        kind: 'daily_reward',
        eventKey: 'daily:2026-10-25',
        xp: 5,
        occurredAt: new Date('2026-10-25T10:00:00.000Z'),
      },
    ]);
  });

  it('is idempotent per day: a repeat grants nothing, audits nothing and reports the same progress', async () => {
    const { deps, progress, audit } = build();
    const claim = new ClaimDailyReward(deps);

    const first = (await claim.execute(CHILD))._unsafeUnwrap();
    const again = (await claim.execute(CHILD))._unsafeUnwrap();

    expect(first.outcome).toBe('granted');
    expect(again).toMatchObject({ outcome: 'already_claimed', leveledUp: false });
    expect(again.progress).toEqual(first.progress);
    expect(progress.rows).toHaveLength(1);
    expect(audit.events).toHaveLength(1);
  });

  it('grants once when two claims arrive together', async () => {
    const { deps, progress, audit } = build();
    const claim = new ClaimDailyReward(deps);

    const results = await Promise.all([claim.execute(CHILD), claim.execute(CHILD)]);

    const outcomes = results.map((result) => result._unsafeUnwrap().outcome).sort();
    expect(outcomes).toEqual(['already_claimed', 'granted']);
    expect(progress.rows).toHaveLength(1);
    expect(audit.events).toHaveLength(1);
  });

  it('offers the reward again on the next Berlin day, and counts the day by Berlin time', async () => {
    const { deps, clock, progress } = build();
    const claim = new ClaimDailyReward(deps);
    await claim.execute(CHILD);

    // 22:59 UTC is still 25 Oct in Berlin (winter time): the same day.
    clock.set(new Date('2026-10-25T22:59:00Z'));
    expect((await claim.execute(CHILD))._unsafeUnwrap().outcome).toBe('already_claimed');

    // 23:00 UTC is 00:00 on 26 Oct in Berlin.
    clock.set(new Date('2026-10-25T23:00:00Z'));
    const next = (await claim.execute(CHILD))._unsafeUnwrap();
    expect(next.outcome).toBe('granted');
    expect(next.progress).toMatchObject({ xp: 10, dailyReward: { dayKey: '2026-10-26' } });
    expect(progress.rows.map((row) => row.eventKey)).toEqual([
      'daily:2026-10-25',
      'daily:2026-10-26',
    ]);
  });

  it('removes nothing for missed days: XP stays, only the companion looked bored and is cheerful again', async () => {
    const { deps, clock, progress } = build();
    progress.rows.push(storedEvent({ occurredAt: new Date('2026-10-10T10:00:00Z'), xp: 18 }));

    const view = (await new ClaimDailyReward(deps).execute(CHILD))._unsafeUnwrap();

    expect(view.progress).toMatchObject({ mood: 'cheerful', boredomLevel: 0 });
    expect(view.progress.xp).toBe(23);
    expect(view.progress.xp).toBeGreaterThanOrEqual(18);
    expect(clock.now()).toEqual(new Date('2026-10-25T10:00:00Z'));
    expect(progress.rows.every((row) => row.xp > 0)).toBe(true);
    expect(progress.rows).toHaveLength(2);
  });

  it('reports a level-up only for the call that crossed the threshold', async () => {
    const { deps, clock, progress } = build();
    progress.rows.push(
      storedEvent({
        eventKey: 'learning:seed',
        kind: 'learning',
        occurredAt: new Date('2026-10-20T10:00:00Z'),
        xp: 15,
      }),
    );
    const claim = new ClaimDailyReward(deps);

    const crossing = (await claim.execute(CHILD))._unsafeUnwrap();
    expect(crossing).toMatchObject({ outcome: 'granted', leveledUp: true });
    expect(crossing.progress).toMatchObject({ xp: 20, level: 2, xpIntoLevel: 0 });

    const repeat = (await claim.execute(CHILD))._unsafeUnwrap();
    expect(repeat).toMatchObject({ outcome: 'already_claimed', leveledUp: false });

    clock.set(new Date('2026-10-26T10:00:00Z'));
    const next = (await claim.execute(CHILD))._unsafeUnwrap();
    expect(next).toMatchObject({ outcome: 'granted', leveledUp: false });
  });

  it('audits the amount and the new level, with ids only', async () => {
    const { deps, audit } = build();

    await new ClaimDailyReward(deps).execute(CHILD);

    expect(audit.events).toEqual([
      {
        type: 'progression.daily_reward_claimed',
        actorId: PARENT_A.id,
        tenantId: PARENT_A.tenantId,
        childProfileId: 'child-1',
        xp: 5,
        level: 1,
      },
    ]);
  });

  it('answers another parent’s child exactly like an unknown id, and writes nothing', async () => {
    const { deps, progress, audit } = build(PARENT_B, ['child-b']);
    const claim = new ClaimDailyReward(deps);

    const foreign = await claim.execute({ childProfileId: 'child-1' });
    const unknown = await claim.execute({ childProfileId: 'nobody' });

    expect(foreign._unsafeUnwrapErr()).toEqual(unknown._unsafeUnwrapErr());
    expect(foreign._unsafeUnwrapErr()).toMatchObject({ code: 'progression.not_found' });
    expect(progress.insertAttempts).toBe(0);
    expect(audit.events).toEqual([]);
  });

  it('refuses a malformed id before any lookup', async () => {
    const { deps, progress } = build();

    const result = await new ClaimDailyReward(deps).execute({ childProfileId: '' });

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'validation',
      fieldErrors: { childProfileId: ['progression.validation.id_invalid'] },
    });
    expect(progress.insertAttempts).toBe(0);
  });

  it('refuses an actor without the permission before asking who owns the child', async () => {
    const { deps, progress, securityAudit } = build({ ...PARENT_A, roles: [] });

    const result = await new ClaimDailyReward(deps).execute(CHILD);

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'auth.permission_denied' });
    expect(progress.insertAttempts).toBe(0);
    expect(securityAudit.events).toHaveLength(1);
  });
});
