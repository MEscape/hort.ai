// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { ActorId, TenantId } from '@modules/auth/domain/models/ids';
import { toChildProfileId } from '@modules/progression/domain/models/ids';
import type { ProgressEventRepository } from '@modules/progression/domain/ports/progress-event.repository';

import type { db as Db } from '@lib/db';

/**
 * The Prisma adapter against the real `ProgressEvent` table: the local Postgres from
 * `docker compose up` after `npm run db:migrate` (CI migrates its own). Skipped when no
 * `DATABASE_URL` is configured. It needs the migration `add_child_welcome_and_progress_events`;
 * on a database without it every test fails at the first query until `npm run db:migrate:app` ran.
 * Every test writes under a tenant of its own, named after the run; the run removes what it wrote
 * (the profile rows, whose delete cascades to their events).
 */
const isEnabled = Boolean(process.env['DATABASE_URL']);

const DAILY_KEY = 'daily:2026-10-25';
const FIRST = new Date('2026-10-25T08:00:00.000Z');
const LATER = new Date('2026-10-25T20:15:30.123Z');

describe.skipIf(!isEnabled)('PrismaProgressEventRepository against Postgres', () => {
  const runId = `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const used: TenantId[] = [];
  let sequence = 0;

  let repository: ProgressEventRepository;
  let db: typeof Db;
  let disconnect: () => Promise<void>;

  /** A parent with one child profile (the events reference it by foreign key). */
  async function freshChild() {
    sequence += 1;
    const tenantId = toTenantId(`${runId}-${sequence}`);
    const ownerId: ActorId = toActorId('parent-1');
    used.push(tenantId);
    const { PrismaChildProfileRepository } =
      await import('@modules/learner/infrastructure/prisma/prisma-child-profile.repository');
    const saved = (
      await new PrismaChildProfileRepository().saveUnfinished({
        tenantId,
        ownerId,
        details: { displayName: 'Lisa', federalState: 'BY', grade: 2 },
      })
    )._unsafeUnwrap();
    if (saved === null) {
      throw new Error('profile was not saved');
    }
    return { owner: { tenantId, ownerId }, childProfileId: toChildProfileId(saved.profile.id) };
  }

  beforeAll(async () => {
    const database = await import('@lib/db');
    const { PrismaProgressEventRepository } =
      await import('@modules/progression/infrastructure/prisma/prisma-progress-event.repository');
    db = database.db;
    disconnect = database.disconnectDb;
    repository = new PrismaProgressEventRepository();
  });

  afterAll(async () => {
    for (const tenantId of used) {
      await db.orm.public.ChildProfile.where({ tenantId }).deleteAndCount();
    }
    await disconnect();
  });

  it('summarizes a child without events as zero XP, no last event, daily reward open', async () => {
    const { owner, childProfileId } = await freshChild();

    const summary = (await repository.summarize(owner, childProfileId, DAILY_KEY))._unsafeUnwrap();

    expect(summary).toEqual({ totalXp: 0, lastEventAt: null, dailyRewardClaimed: false });
  });

  it('stores a reward once and summarizes the total, the latest instant and the claimed day', async () => {
    const { owner, childProfileId } = await freshChild();

    const stored = await repository.insertOnce(owner, {
      childProfileId,
      kind: 'daily_reward',
      eventKey: DAILY_KEY,
      xp: 5,
      occurredAt: FIRST,
    });
    await repository.insertOnce(owner, {
      childProfileId,
      kind: 'learning',
      eventKey: 'learning:session-1',
      xp: 10,
      occurredAt: LATER,
    });

    expect(stored._unsafeUnwrap()).toBe(true);
    const summary = (await repository.summarize(owner, childProfileId, DAILY_KEY))._unsafeUnwrap();
    expect(summary).toEqual({ totalXp: 15, lastEventAt: LATER, dailyRewardClaimed: true });
    expect(
      (await repository.summarize(owner, childProfileId, 'daily:2026-10-26'))._unsafeUnwrap()
        .dailyRewardClaimed,
    ).toBe(false);
  });

  it('answers false and stores nothing more for a repeated key', async () => {
    const { owner, childProfileId } = await freshChild();
    const event = {
      childProfileId,
      kind: 'daily_reward',
      eventKey: DAILY_KEY,
      xp: 5,
      occurredAt: FIRST,
    } as const;

    const first = await repository.insertOnce(owner, event);
    const again = await repository.insertOnce(owner, { ...event, occurredAt: LATER });

    expect(first._unsafeUnwrap()).toBe(true);
    expect(again._unsafeUnwrap()).toBe(false);
    const summary = (await repository.summarize(owner, childProfileId, DAILY_KEY))._unsafeUnwrap();
    expect(summary).toMatchObject({ totalXp: 5, lastEventAt: FIRST });
  });

  it('grants exactly once when many identical inserts arrive at once', async () => {
    const { owner, childProfileId } = await freshChild();

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        repository.insertOnce(owner, {
          childProfileId,
          kind: 'daily_reward',
          eventKey: DAILY_KEY,
          xp: 5,
          occurredAt: FIRST,
        }),
      ),
    );

    expect(results.map((result) => result._unsafeUnwrap()).filter(Boolean)).toHaveLength(1);
    expect(
      (await repository.summarize(owner, childProfileId, DAILY_KEY))._unsafeUnwrap().totalXp,
    ).toBe(5);
  });

  it('never reads another parent’s or tenant’s rows of the same child', async () => {
    const { owner, childProfileId } = await freshChild();
    await repository.insertOnce(owner, {
      childProfileId,
      kind: 'daily_reward',
      eventKey: DAILY_KEY,
      xp: 5,
      occurredAt: FIRST,
    });

    const otherParent = await repository.summarize(
      { ...owner, ownerId: toActorId('parent-2') },
      childProfileId,
      DAILY_KEY,
    );
    const otherTenant = await repository.summarize(
      { ...owner, tenantId: toTenantId(`${runId}-other`) },
      childProfileId,
      DAILY_KEY,
    );

    for (const summary of [otherParent, otherTenant]) {
      expect(summary._unsafeUnwrap()).toEqual({
        totalXp: 0,
        lastEventAt: null,
        dailyRewardClaimed: false,
      });
    }
  });

  it('refuses an event with an amount outside 1..100 as an infrastructure failure, not a duplicate', async () => {
    const { owner, childProfileId } = await freshChild();

    const result = await repository.insertOnce(owner, {
      childProfileId,
      kind: 'learning',
      eventKey: 'learning:bad',
      xp: -5,
      occurredAt: FIRST,
    });

    expect(result._unsafeUnwrapErr()).toMatchObject({ kind: 'infrastructure' });
  });

  it('removes a profile’s events with the profile (the foreign key cascades)', async () => {
    const { owner, childProfileId } = await freshChild();
    await repository.insertOnce(owner, {
      childProfileId,
      kind: 'daily_reward',
      eventKey: DAILY_KEY,
      xp: 5,
      occurredAt: FIRST,
    });

    await db.orm.public.ChildProfile.where({ id: childProfileId }).deleteAndCount();

    const remaining = await db.orm.public.ProgressEvent.where({ childProfileId }).all();
    expect(remaining).toEqual([]);
  });
});
