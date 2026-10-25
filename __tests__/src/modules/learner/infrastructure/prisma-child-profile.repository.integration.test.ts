// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toActorId, toTenantId, toTutorId } from '@modules/learner/domain/models/ids';
import type { ActorId, TenantId } from '@modules/learner/domain/models/ids';
import type {
  ChildProfileRepository,
  UnfinishedProfileInput,
} from '@modules/learner/domain/ports/child-profile.repository';

import type { conflictConstraint as ConflictConstraint, db as Db } from '@lib/db';

/**
 * The Prisma adapter against the real `ChildProfile` table: the local Postgres from
 * `docker compose up` after `npm run db:migrate` (CI migrates its own). Skipped when no
 * `DATABASE_URL` is configured. Every test writes under a tenant of its own, named after the run,
 * and the run removes what it wrote.
 */
const isEnabled = Boolean(process.env['DATABASE_URL']);

const DETAILS = { displayName: 'Lisa', federalState: 'BY', grade: 2 } as const;
const LIMIT = 10;
const COMPLETED_AT = new Date('2026-10-24T12:34:56.789Z');

describe.skipIf(!isEnabled)('PrismaChildProfileRepository against Postgres', () => {
  const runId = `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const used: TenantId[] = [];
  let sequence = 0;

  let repository: ChildProfileRepository;
  let db: typeof Db;
  let conflictConstraint: typeof ConflictConstraint;
  let disconnect: () => Promise<void>;

  function freshOwner(): { tenantId: TenantId; ownerId: ActorId } {
    sequence += 1;
    const tenantId = toTenantId(`${runId}-${sequence}`);
    used.push(tenantId);
    return { tenantId, ownerId: toActorId('parent-1') };
  }

  const input = (owner: { tenantId: TenantId; ownerId: ActorId }): UnfinishedProfileInput => ({
    ...owner,
    details: DETAILS,
  });

  async function save(
    owner: ReturnType<typeof freshOwner>,
    details: UnfinishedProfileInput['details'] = DETAILS,
  ) {
    const result = await repository.saveUnfinished({ ...input(owner), details });
    return result._unsafeUnwrap();
  }

  async function saveProfile(owner: ReturnType<typeof freshOwner>) {
    const saved = await save(owner);
    if (saved === null) {
      throw new Error('profile was not saved');
    }
    return saved.profile;
  }

  async function list(owner: ReturnType<typeof freshOwner>) {
    return (await repository.listByOwner(owner.ownerId, owner.tenantId, LIMIT))._unsafeUnwrap();
  }

  beforeAll(async () => {
    const database = await import('@lib/db');
    const { PrismaChildProfileRepository } =
      await import('@modules/learner/infrastructure/prisma/prisma-child-profile.repository');
    db = database.db;
    conflictConstraint = database.conflictConstraint;
    disconnect = database.disconnectDb;
    repository = new PrismaChildProfileRepository();
  });

  afterAll(async () => {
    for (const tenantId of used) {
      await db.orm.public.ChildProfile.where({ tenantId }).deleteAndCount();
    }
    await disconnect();
  });

  it('inserts an unfinished profile and reads it back as the domain model', async () => {
    const owner = freshOwner();

    const saved = await save(owner);

    expect(saved?.isNew).toBe(true);
    expect(saved?.profile).toMatchObject({
      ...owner,
      ...DETAILS,
      interests: [],
      tutorId: null,
      controls: {
        voiceEnabled: false,
        dailyLimitMinutes: null,
        allowedWindow: null,
        learningInsights: false,
      },
      guardian: null,
      setupStep: 'interests',
      setupCompletedAt: null,
    });
    expect(saved?.profile.createdAt).toBeInstanceOf(Date);
    expect(await list(owner)).toEqual([saved?.profile]);
  });

  it('replaces the details of the one unfinished profile instead of adding a second row', async () => {
    const owner = freshOwner();

    const first = await save(owner);
    const corrected = await save(owner, { displayName: 'Lina', federalState: 'NW', grade: 3 });

    expect(corrected?.isNew).toBe(false);
    expect(corrected?.profile).toMatchObject({
      id: first?.profile.id,
      displayName: 'Lina',
      federalState: 'NW',
      grade: 3,
    });
    expect(await list(owner)).toHaveLength(1);
  });

  it('leaves one unfinished profile when several submits arrive at once', async () => {
    const owner = freshOwner();

    const results = await Promise.all(
      Array.from({ length: 6 }, () => repository.saveUnfinished(input(owner))),
    );

    expect(results.every((result) => result.isOk())).toBe(true);
    const saved = results.flatMap((result) => result._unsafeUnwrap() ?? []);
    expect(new Set(saved.map(({ profile }) => profile.id)).size).toBe(1);
    expect(saved.filter(({ isNew }) => isNew)).toHaveLength(1);
    expect(await list(owner)).toHaveLength(1);
  });

  async function reachReview(owner: ReturnType<typeof freshOwner>) {
    const profile = await saveProfile(owner);
    const stored = await repository.updateUnfinished(profile, { interests: [] }, 'review');
    return stored._unsafeUnwrap() ?? profile;
  }

  it('completes the setup once from the review step and stores the exact UTC instant', async () => {
    const owner = freshOwner();
    const profile = await reachReview(owner);

    const first = await repository.markSetupCompleted(profile, COMPLETED_AT);
    const second = await repository.markSetupCompleted(profile, new Date());

    expect([first._unsafeUnwrap(), second._unsafeUnwrap()]).toEqual([true, false]);
    expect((await list(owner))[0]).toMatchObject({
      setupStep: 'done',
      setupCompletedAt: COMPLETED_AT,
    });
  });

  it('refuses to complete a profile that has not reached the review step', async () => {
    const owner = freshOwner();
    const profile = await saveProfile(owner);
    await repository.updateUnfinished(profile, { interests: [] }, 'controls');

    const outcome = await repository.markSetupCompleted(profile, COMPLETED_AT);

    expect(outcome._unsafeUnwrap()).toBe(false);
    expect((await list(owner))[0]).toMatchObject({ setupStep: 'controls', setupCompletedAt: null });
  });

  it('lets exactly one of several simultaneous completions win', async () => {
    const owner = freshOwner();
    const profile = await reachReview(owner);

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () => repository.markSetupCompleted(profile, COMPLETED_AT)),
    );

    expect(outcomes.filter((outcome) => outcome._unsafeUnwrap())).toHaveLength(1);
  });

  it('stores interests, tutor, controls and the guardian confirmation and reads them back', async () => {
    const owner = freshOwner();
    const profile = await saveProfile(owner);
    const confirmedAt = new Date('2026-10-24T09:15:30.250Z');

    await repository.updateUnfinished(profile, { interests: ['art', 'music'] }, 'tutor');
    await repository.updateUnfinished(profile, { tutorId: toTutorId('lili') }, 'controls');
    const stored = (
      await repository.updateUnfinished(
        profile,
        {
          controls: {
            voiceEnabled: true,
            dailyLimitMinutes: 45,
            allowedWindow: { fromMinute: 540, untilMinute: 1080 },
            learningInsights: true,
          },
          guardian: { confirmedAt, consentVersion: '2026-10-24' },
        },
        'review',
      )
    )._unsafeUnwrap();

    expect(stored).toMatchObject({
      interests: ['art', 'music'],
      tutorId: 'lili',
      controls: {
        voiceEnabled: true,
        dailyLimitMinutes: 45,
        allowedWindow: { fromMinute: 540, untilMinute: 1080 },
        learningInsights: true,
      },
      guardian: { confirmedAt, consentVersion: '2026-10-24' },
      setupStep: 'review',
    });
    expect((await list(owner))[0]).toEqual(stored);
  });

  it('clears the limit and the window again when the controls are saved without them', async () => {
    const owner = freshOwner();
    const profile = await saveProfile(owner);
    const controls = {
      voiceEnabled: false,
      dailyLimitMinutes: null,
      allowedWindow: null,
      learningInsights: false,
    };
    await repository.updateUnfinished(
      profile,
      {
        controls: {
          ...controls,
          dailyLimitMinutes: 15,
          allowedWindow: { fromMinute: 0, untilMinute: 60 },
        },
      },
      'review',
    );

    const stored = (
      await repository.updateUnfinished(profile, { controls }, 'review')
    )._unsafeUnwrap();

    expect(stored?.controls).toEqual(controls);
  });

  it('only moves the step forward, whatever the order of the writes', async () => {
    const owner = freshOwner();
    const profile = await saveProfile(owner);

    await repository.updateUnfinished(profile, { tutorId: toTutorId('max') }, 'review');
    const edited = (
      await repository.updateUnfinished(profile, { interests: ['nature'] }, 'tutor')
    )._unsafeUnwrap();

    expect(edited).toMatchObject({ setupStep: 'review', interests: ['nature'], tutorId: 'max' });
  });

  it('ends at the furthest step when five writes to different steps arrive at once', async () => {
    const owner = freshOwner();
    const profile = await saveProfile(owner);
    const steps = ['tutor', 'review', 'controls', 'tutor', 'review'] as const;

    const outcomes = await Promise.all(
      steps.map((step) => repository.updateUnfinished(profile, { interests: ['art'] }, step)),
    );

    expect(outcomes.every((outcome) => outcome.isOk() && outcome.value !== null)).toBe(true);
    expect((await list(owner))[0]?.setupStep).toBe('review');
  });

  it('writes nothing to a finished profile', async () => {
    const owner = freshOwner();
    const profile = await reachReview(owner);
    await repository.markSetupCompleted(profile, COMPLETED_AT);

    const outcome = await repository.updateUnfinished(
      profile,
      { tutorId: toTutorId('max') },
      'controls',
    );

    expect(outcome._unsafeUnwrap()).toBeNull();
    expect((await list(owner))[0]).toMatchObject({ tutorId: null, setupStep: 'done' });
  });

  it('keeps the furthest step when the details of the unfinished profile are corrected', async () => {
    const owner = freshOwner();
    const profile = await saveProfile(owner);
    await repository.updateUnfinished(profile, { tutorId: toTutorId('max') }, 'controls');

    const corrected = await save(owner, { displayName: 'Lina', federalState: 'NW', grade: 3 });

    expect(corrected?.profile).toMatchObject({
      displayName: 'Lina',
      setupStep: 'controls',
      tutorId: 'max',
    });
  });

  it('reads and writes only the owner own profile in the owner own tenant', async () => {
    const owner = freshOwner();
    const profile = await saveProfile(owner);
    const otherParent = toActorId('parent-2');
    const otherTenant = toTenantId(`${owner.tenantId}-other`);

    const own = await repository.findOwned(profile.id, owner.ownerId, owner.tenantId);
    const foreign = await repository.findOwned(profile.id, otherParent, owner.tenantId);
    const elsewhere = await repository.findOwned(profile.id, owner.ownerId, otherTenant);
    const hijackStep = await repository.updateUnfinished(
      { ...profile, ownerId: otherParent },
      { tutorId: toTutorId('max') },
      'review',
    );
    const hijackDone = await repository.markSetupCompleted(
      { ...profile, ownerId: otherParent },
      COMPLETED_AT,
    );

    expect(own._unsafeUnwrap()?.id).toBe(profile.id);
    expect(foreign._unsafeUnwrap()).toBeNull();
    expect(elsewhere._unsafeUnwrap()).toBeNull();
    expect(hijackStep._unsafeUnwrap()).toBeNull();
    expect(hijackDone._unsafeUnwrap()).toBe(false);
    expect((await list(owner))[0]).toMatchObject({ tutorId: null, setupStep: 'interests' });
    expect(
      (await repository.listByOwner(otherParent, owner.tenantId, LIMIT))._unsafeUnwrap(),
    ).toEqual([]);
  });

  it('deletes all of the owner’s profiles, finished or not, and nothing of anyone else', async () => {
    const owner = freshOwner();
    const other = { tenantId: owner.tenantId, ownerId: toActorId('parent-2') };
    const elsewhere = { tenantId: toTenantId(`${owner.tenantId}-other`), ownerId: owner.ownerId };
    used.push(elsewhere.tenantId);
    const first = await reachReview(owner);
    await repository.markSetupCompleted(first, COMPLETED_AT);
    await saveProfile(owner);
    await saveProfile(other);
    await saveProfile(elsewhere);

    const deleted = await repository.deleteAllOwned(owner);

    expect(deleted._unsafeUnwrap()).toBe(2);
    expect(await list(owner)).toEqual([]);
    expect(await list(other)).toHaveLength(1);
    expect(await list(elsewhere)).toHaveLength(1);
  });

  it('deletes 0 rows without failing when the owner has none', async () => {
    const outcome = await repository.deleteAllOwned(freshOwner());

    expect(outcome._unsafeUnwrap()).toBe(0);
  });

  it('lists the oldest profile first and honours the limit', async () => {
    const owner = freshOwner();
    const first = await reachReview(owner);
    await repository.markSetupCompleted(first, COMPLETED_AT);
    const second = (await save(owner))?.profile;

    const all = await list(owner);
    const one = (await repository.listByOwner(owner.ownerId, owner.tenantId, 1))._unsafeUnwrap();

    expect(all.map(({ id }) => id)).toEqual([first.id, second?.id]);
    expect(one.map(({ id }) => id)).toEqual([first.id]);
  });

  it('lets the database refuse a second unfinished profile, under the name the repository recovers from', async () => {
    const owner = freshOwner();
    const row = { ...owner, displayName: 'Lisa', federalState: 'BY', grade: 2 } as const;
    await db.orm.public.ChildProfile.create(row);

    const thrown = await db.orm.public.ChildProfile.create(row).catch((error: unknown) => error);

    expect(conflictConstraint(thrown)).toMatch(/^ChildProfile_one_unfinished_per_owner/);
  });

  it('enforces the domain limits in the database as well', async () => {
    const owner = freshOwner();
    const base = { ...owner, displayName: 'Lisa', federalState: 'BY', grade: 2 } as const;

    await expect(
      db.orm.public.ChildProfile.create({ ...base, ownerId: 'a', grade: 5 }),
    ).rejects.toBeDefined();
    await expect(
      db.orm.public.ChildProfile.create({ ...base, ownerId: 'b', displayName: 'x'.repeat(25) }),
    ).rejects.toBeDefined();
    await expect(
      db.orm.public.ChildProfile.create({ ...base, ownerId: 'c', displayName: '' }),
    ).rejects.toBeDefined();
  });

  it('refuses values the CHECK constraints do not allow', async () => {
    const owner = freshOwner();
    const base = { ...owner, displayName: 'Lisa', federalState: 'BY', grade: 2 } as const;
    const create = (ownerId: string, extra: Record<string, unknown>) =>
      db.orm.public.ChildProfile.create({ ...base, ownerId, ...extra });

    await expect(
      create('c1', { interests: ['nature', 'animals', 'science', 'art', 'music'] }),
    ).rejects.toBeDefined();
    await expect(create('c2', { interests: ['football'] })).rejects.toBeDefined();
    await expect(create('c3', { dailyLimitMinutes: 20 })).rejects.toBeDefined();
    await expect(create('c4', { allowedFromMinute: 600 })).rejects.toBeDefined();
    await expect(
      create('c5', { allowedFromMinute: 600, allowedUntilMinute: 600 }),
    ).rejects.toBeDefined();
    await expect(
      create('c6', { allowedFromMinute: 600, allowedUntilMinute: 615 }),
    ).rejects.toBeDefined();
    await expect(
      create('c7', { allowedFromMinute: 601, allowedUntilMinute: 720 }),
    ).rejects.toBeDefined();
    await expect(
      create('c8', { allowedFromMinute: 600, allowedUntilMinute: 1455 }),
    ).rejects.toBeDefined();
    await expect(create('c9', { setupStep: 'later' })).rejects.toBeDefined();
    await expect(create('c10', { setupStep: 'done' })).rejects.toBeDefined();
  });

  it('accepts the values the CHECK constraints allow', async () => {
    const owner = freshOwner();
    const created = await db.orm.public.ChildProfile.create({
      ...owner,
      displayName: 'Lisa',
      federalState: 'BY',
      grade: 2,
      interests: ['nature', 'animals', 'science', 'art'],
      dailyLimitMinutes: 90,
      allowedFromMinute: 0,
      allowedUntilMinute: 1440,
    });

    expect(created).toMatchObject({
      dailyLimitMinutes: 90,
      setupStep: 'child',
      learningInsights: false,
    });
  });

  it('takes over a class’s settings on the owner’s profile only, finished or not', async () => {
    const owner = freshOwner();
    const profile = await saveProfile(owner);

    const adopted = await repository.adoptClassroomSettings(profile, {
      federalState: 'HE',
      grade: 3,
    });
    expect(adopted._unsafeUnwrap()).toMatchObject({ id: profile.id, federalState: 'HE', grade: 3 });

    const stranger = { ...profile, ownerId: toActorId('parent-2') };
    const foreign = await repository.adoptClassroomSettings(stranger, {
      federalState: 'BY',
      grade: 1,
    });
    expect(foreign._unsafeUnwrap()).toBeNull();
    const stored = await repository.findOwned(profile.id, owner.ownerId, owner.tenantId);
    expect(stored._unsafeUnwrap()).toMatchObject({ federalState: 'HE', grade: 3 });
  });
});
