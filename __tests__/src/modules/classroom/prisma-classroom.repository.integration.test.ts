// @vitest-environment node
import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import { toChildProfileId, toClassroomId } from '@modules/classroom/domain/models/ids';
import type { ClassroomRepository } from '@modules/classroom/domain/ports/classroom.repository';

import type { dateToInstant as DateToInstant, db as Db } from '@lib/db';

/**
 * Joining a class against the real tables (local Postgres after `npm run db:migrate`; CI migrates
 * its own). Skipped without `DATABASE_URL`. The code check of `addMember` must hold under
 * concurrency: a code replaced, or a class archived, while the join waits for the class's lock
 * admits no one. Every row is written under a tenant of this run and removed afterwards.
 */
const isEnabled = Boolean(process.env['DATABASE_URL']);

/** Invite code hashes are unique across all tenants: never reuse one between runs. */
const freshHash = () => randomBytes(32).toString('hex');
const NOW = new Date('2026-10-24T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!isEnabled)('PrismaClassroomRepository.addMember against Postgres', () => {
  const rawTenantId = `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const tenantId = toTenantId(rawTenantId);
  let db: typeof Db;
  let dateToInstant: typeof DateToInstant;
  let disconnect: () => Promise<void>;
  let repository: ClassroomRepository;
  let sequence = 0;

  async function classAndChild(issuedDaysAgo = 0) {
    sequence += 1;
    const hash = freshHash();
    const room = await db.orm.public.Classroom.create({
      tenantId: rawTenantId,
      ownerId: 'teacher-1',
      name: `Klasse ${String(sequence)}`,
      federalState: 'HE',
      grade: 3,
      subject: 'MATH',
      inviteCodeHash: hash,
      inviteCodeIssuedAt: dateToInstant(new Date(NOW.getTime() - issuedDaysAgo * DAY_MS)),
    });
    const child = await db.orm.public.ChildProfile.create({
      tenantId: rawTenantId,
      ownerId: `parent-${String(sequence)}`,
      displayName: 'Mia',
      federalState: 'HE',
      grade: 3,
    });
    return {
      hash,
      membership: {
        tenantId,
        classroomId: toClassroomId(room.id),
        childProfileId: toChildProfileId(child.id),
        inviteCodeHash: hash,
      },
    };
  }

  const membersOf = (classroomId: string) =>
    db.orm.public.ClassMembership.where({ classroomId, tenantId: rawTenantId }).all();

  /** Runs `change` in a transaction that holds the class row until the returned release is called. */
  async function holdWhile(classroomId: string, change: Record<string, unknown>) {
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked!: () => void;
    const isLocked = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const transaction = db.transaction(async (tx) => {
      await tx.orm.public.Classroom.where({
        id: classroomId,
        tenantId: rawTenantId,
      }).updateAndCount(change);
      locked();
      await released;
    });
    await isLocked;
    return { release, done: transaction };
  }

  async function isPending(pending: Promise<unknown>): Promise<boolean> {
    const marker = Symbol('pending');
    const settled = await Promise.race([
      pending.then(
        () => null,
        () => null,
      ),
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(marker);
        }, 300);
      }),
    ]);
    return settled === marker;
  }

  beforeAll(async () => {
    const database = await import('@lib/db');
    db = database.db;
    dateToInstant = database.dateToInstant;
    disconnect = database.disconnectDb;
    const { PrismaClassroomRepository } =
      await import('@modules/classroom/infrastructure/prisma/prisma-classroom.repository');
    repository = new PrismaClassroomRepository({ now: () => NOW });
  });

  afterAll(async () => {
    // Memberships go with their parents (ON DELETE CASCADE).
    await db.orm.public.ChildProfile.where({ tenantId: rawTenantId }).deleteAndCount();
    await db.orm.public.Classroom.where({ tenantId: rawTenantId }).deleteAndCount();
    await disconnect();
  });

  it('admits a child with the current code and leaves the class unchanged', async () => {
    const { membership } = await classAndChild(13);

    expect((await repository.addMember(membership)).isOk()).toBe(true);
    expect(await membersOf(membership.classroomId)).toHaveLength(1);
    const room = await db.orm.public.Classroom.where({ id: membership.classroomId }).first();
    expect(room?.status).toBe('ACTIVE');
  });

  it('refuses an expired code', async () => {
    const { membership } = await classAndChild(15);

    const result = await repository.addMember(membership);

    expect(result._unsafeUnwrapErr().code).toBe('classroom.invite_code_invalid');
    expect(await membersOf(membership.classroomId)).toHaveLength(0);
  });

  it('refuses the old code once it was replaced', async () => {
    const { membership } = await classAndChild();
    await db.orm.public.Classroom.where({ id: membership.classroomId }).updateAndCount({
      inviteCodeHash: freshHash(),
    });

    const result = await repository.addMember(membership);

    expect(result._unsafeUnwrapErr().code).toBe('classroom.invite_code_invalid');
    expect(await membersOf(membership.classroomId)).toHaveLength(0);
  });

  it('waits for a code replacement in flight and then admits no one', async () => {
    const { membership } = await classAndChild();
    const rotation = await holdWhile(membership.classroomId, { inviteCodeHash: freshHash() });

    // Started now, still waiting for the class row when checked below.
    const join = (async () => repository.addMember(membership))();
    expect(await isPending(join)).toBe(true);
    rotation.release();
    await rotation.done;

    expect((await join)._unsafeUnwrapErr().code).toBe('classroom.invite_code_invalid');
    expect(await membersOf(membership.classroomId)).toHaveLength(0);
  });

  it('waits for an archive in flight, admits no one and keeps the class archived', async () => {
    const { membership } = await classAndChild();
    const archive = await holdWhile(membership.classroomId, { status: 'ARCHIVED' });

    // Started now, still waiting for the class row when checked below.
    const join = (async () => repository.addMember(membership))();
    expect(await isPending(join)).toBe(true);
    archive.release();
    await archive.done;

    expect((await join)._unsafeUnwrapErr().code).toBe('classroom.invite_code_invalid');
    expect(await membersOf(membership.classroomId)).toHaveLength(0);
    const room = await db.orm.public.Classroom.where({ id: membership.classroomId }).first();
    expect(room?.status).toBe('ARCHIVED');
  });
});
