import { describe, expect, it } from 'vitest';

import { GetProgress } from '@modules/progression/application/queries/get-progress';

import { PARENT_A, PARENT_B, build, storedEvent } from '../fakes';

const CHILD = { childProfileId: 'child-1' };

describe('GetProgress', () => {
  it('starts a new child at level 1 with the daily reward available and a new companion', async () => {
    const { deps } = build();

    const view = (await new GetProgress(deps).execute(CHILD))._unsafeUnwrap();

    expect(view).toEqual({
      childProfileId: 'child-1',
      xp: 0,
      level: 1,
      maxLevel: 6,
      xpIntoLevel: 0,
      xpForNextLevel: 20,
      fraction: 0,
      dailyReward: { status: 'available', xp: 5, dayKey: '2026-10-25' },
      mood: 'new',
      boredomLevel: 0,
      daysAway: 0,
      lastActivityAt: null,
    });
  });

  it('never writes: opening or refreshing a screen earns nothing', async () => {
    const { deps, progress, audit } = build();
    const get = new GetProgress(deps);

    await get.execute(CHILD);
    await get.execute(CHILD);

    expect(progress.insertAttempts).toBe(0);
    expect(progress.rows).toEqual([]);
    expect(audit.events).toEqual([]);
  });

  it('derives level and mood from the stored events', async () => {
    const { deps, progress } = build();
    progress.rows.push(
      storedEvent({ occurredAt: new Date('2026-10-23T10:00:00Z'), xp: 30 }),
      storedEvent({
        eventKey: 'learning:a',
        kind: 'learning',
        occurredAt: new Date('2026-10-24T10:00:00Z'),
        xp: 10,
      }),
    );

    const view = (await new GetProgress(deps).execute(CHILD))._unsafeUnwrap();

    expect(view).toMatchObject({
      xp: 40,
      level: 2,
      xpIntoLevel: 20,
      xpForNextLevel: 30,
      mood: 'calm',
      boredomLevel: 1,
      daysAway: 1,
      dailyReward: { status: 'available' },
      lastActivityAt: new Date('2026-10-24T10:00:00Z'),
    });
  });

  it('shows the daily reward as claimed once today’s event is stored', async () => {
    const { deps, progress } = build();
    progress.rows.push(storedEvent());

    const view = (await new GetProgress(deps).execute(CHILD))._unsafeUnwrap();

    expect(view.dailyReward).toEqual({ status: 'claimed', xp: 5, dayKey: '2026-10-25' });
    expect(view).toMatchObject({ mood: 'cheerful', boredomLevel: 0 });
  });

  it('a missed week leaves the XP untouched and the companion bored, not sad', async () => {
    const { deps, progress } = build();
    progress.rows.push(storedEvent({ occurredAt: new Date('2026-10-12T10:00:00Z'), xp: 25 }));

    const view = (await new GetProgress(deps).execute(CHILD))._unsafeUnwrap();

    expect(view).toMatchObject({ xp: 25, level: 2, mood: 'bored', boredomLevel: 4, daysAway: 13 });
  });

  it('shows a full meter at the top level', async () => {
    const { deps, progress } = build();
    progress.rows.push(storedEvent({ xp: 100 }), storedEvent({ eventKey: 'learning:x', xp: 100 }));

    const view = (await new GetProgress(deps).execute(CHILD))._unsafeUnwrap();

    expect(view).toMatchObject({ level: 6, xpForNextLevel: null, fraction: 1 });
  });

  it('does not count another parent’s rows', async () => {
    const { deps, progress } = build();
    progress.rows.push(storedEvent({ ownerId: PARENT_B.id, xp: 50 }));

    const view = (await new GetProgress(deps).execute(CHILD))._unsafeUnwrap();

    expect(view.xp).toBe(0);
  });

  it('answers another parent’s child like an unknown id', async () => {
    const { deps } = build(PARENT_A, ['child-1']);
    const get = new GetProgress(deps);

    const foreign = await get.execute({ childProfileId: 'child-b' });
    const unknown = await get.execute({ childProfileId: 'nobody' });

    expect(foreign._unsafeUnwrapErr()).toEqual(unknown._unsafeUnwrapErr());
    expect(foreign._unsafeUnwrapErr()).toMatchObject({ code: 'progression.not_found' });
  });

  it('refuses an actor without the permission', async () => {
    const { deps } = build({ ...PARENT_A, roles: [] });

    const result = await new GetProgress(deps).execute(CHILD);

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'auth.permission_denied' });
  });
});
