import { describe, expect, it } from 'vitest';

import { AwardLearningXp } from '@modules/progression/application/commands/award-learning-xp';
import type { AwardLearningXpInput } from '@modules/progression/application/contracts/progression-inputs';
import { LEARNING_EVENT_KEY_MAX_LENGTH } from '@modules/progression/domain/models/xp-rules';

import { PARENT_A, PARENT_B, build } from '../fakes';

const SESSION: AwardLearningXpInput = {
  childProfileId: 'child-1',
  event: 'help_session_completed',
  eventKey: 'session-42',
};

describe('AwardLearningXp', () => {
  it('stores the amount of the event KIND under a learning: key and audits it', async () => {
    const { deps, progress, audit } = build();

    const view = (await new AwardLearningXp(deps).execute(SESSION))._unsafeUnwrap();

    expect(view).toMatchObject({ outcome: 'granted', leveledUp: false, progress: { xp: 10 } });
    expect(progress.rows).toMatchObject([
      { kind: 'learning', eventKey: 'learning:session-42', xp: 10 },
    ]);
    expect(audit.events).toEqual([
      {
        type: 'progression.xp_awarded',
        actorId: PARENT_A.id,
        tenantId: PARENT_A.tenantId,
        childProfileId: 'child-1',
        event: 'help_session_completed',
        xp: 10,
        level: 1,
      },
    ]);
  });

  it('pays the smaller amount for a passed comprehension check', async () => {
    const { deps } = build();

    const view = (
      await new AwardLearningXp(deps).execute({
        ...SESSION,
        event: 'comprehension_check_passed',
      })
    )._unsafeUnwrap();

    expect(view.progress.xp).toBe(5);
  });

  it('is idempotent per key: a repeat is a duplicate, grants and audits nothing', async () => {
    const { deps, progress, audit } = build();
    const award = new AwardLearningXp(deps);

    const first = (await award.execute(SESSION))._unsafeUnwrap();
    const again = (await award.execute(SESSION))._unsafeUnwrap();

    expect(again).toMatchObject({ outcome: 'duplicate', leveledUp: false });
    expect(again.progress).toEqual(first.progress);
    expect(progress.rows).toHaveLength(1);
    expect(audit.events).toHaveLength(1);
  });

  it('grants once when the same key arrives twice at once', async () => {
    const { deps, progress } = build();
    const award = new AwardLearningXp(deps);

    await Promise.all([award.execute(SESSION), award.execute(SESSION)]);

    expect(progress.rows).toHaveLength(1);
  });

  it('keeps the daily key space out of reach: a caller key that looks like a daily key is a learning key', async () => {
    const { deps, progress } = build();

    await new AwardLearningXp(deps).execute({ ...SESSION, eventKey: 'daily:2026-10-25' });

    expect(progress.rows[0]?.eventKey).toBe('learning:daily:2026-10-25');
  });

  it('reports a level-up when the award crosses a threshold', async () => {
    const { deps } = build();
    const award = new AwardLearningXp(deps);

    await award.execute({ ...SESSION, eventKey: 'a' });
    const crossing = (await award.execute({ ...SESSION, eventKey: 'b' }))._unsafeUnwrap();

    expect(crossing).toMatchObject({ leveledUp: true, progress: { xp: 20, level: 2 } });
  });

  it.each([
    ['', 'eventKey'],
    ['has space', 'eventKey'],
    ['umlaut-ä', 'eventKey'],
    ['x'.repeat(LEARNING_EVENT_KEY_MAX_LENGTH + 1), 'eventKey'],
  ])('refuses the event key %j as a field error and stores nothing', async (eventKey, field) => {
    const { deps, progress, audit } = build();

    const result = await new AwardLearningXp(deps).execute({ ...SESSION, eventKey });

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'validation',
      fieldErrors: { [field]: ['progression.validation.event_key_invalid'] },
    });
    expect(progress.insertAttempts).toBe(0);
    expect(audit.events).toEqual([]);
  });

  it('accepts the longest key that still fits the column with its prefix', async () => {
    const { deps, progress } = build();

    const result = await new AwardLearningXp(deps).execute({
      ...SESSION,
      eventKey: 'k'.repeat(LEARNING_EVENT_KEY_MAX_LENGTH),
    });

    expect(result.isOk()).toBe(true);
    expect(progress.rows[0]?.eventKey).toHaveLength(64);
  });

  it('refuses an event kind outside the rules table, so no amount can be smuggled in', async () => {
    const { deps, progress } = build();

    const result = await new AwardLearningXp(deps).execute({
      ...SESSION,
      event: 'toString' as never,
    });

    expect(result._unsafeUnwrapErr()).toMatchObject({
      fieldErrors: { event: ['progression.validation.event_invalid'] },
    });
    expect(progress.insertAttempts).toBe(0);
  });

  it('answers another parent’s child like an unknown id, and writes nothing', async () => {
    const { deps, progress, audit } = build(PARENT_B, ['child-b']);

    const result = await new AwardLearningXp(deps).execute(SESSION);

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'progression.not_found' });
    expect(progress.insertAttempts).toBe(0);
    expect(audit.events).toEqual([]);
  });

  it('refuses an actor without the permission', async () => {
    const { deps, progress } = build({ ...PARENT_A, roles: [] });

    const result = await new AwardLearningXp(deps).execute(SESSION);

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'auth.permission_denied' });
    expect(progress.insertAttempts).toBe(0);
  });
});
