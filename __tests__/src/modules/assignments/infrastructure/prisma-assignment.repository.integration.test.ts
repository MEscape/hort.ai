// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toAssignmentId, toClassroomId } from '@modules/assignments/domain/models/ids';
import { PrismaAssignmentRepository } from '@modules/assignments/infrastructure/prisma/prisma-assignment.repository';
import { toActorId, toTenantId } from '@modules/auth';

import type { db as Db } from '@lib/db';

/**
 * The assignment repository against the real tables: the local Postgres after `npm run db:migrate`
 * (CI migrates its own). Skipped without a `DATABASE_URL`. Every row is written under a tenant of
 * this run and removed afterwards.
 */
const isEnabled = Boolean(process.env['DATABASE_URL']);

describe.skipIf(!isEnabled)('PrismaAssignmentRepository against Postgres', () => {
  const tenantId = toTenantId(
    `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const teacherA = { tenantId, ownerId: toActorId('teacher-a') };
  const teacherB = { tenantId, ownerId: toActorId('teacher-b') };
  const clock = { now: () => new Date('2026-10-25T08:00:00Z') };
  const draft = { title: 'Murmeln', text: '36 : 4', dueDate: '2026-11-02', solutionKey: '9' };
  let db: typeof Db;
  let disconnect: () => Promise<void>;
  let classroomId: ReturnType<typeof toClassroomId>;

  beforeAll(async () => {
    const database = await import('@lib/db');
    db = database.db;
    disconnect = database.disconnectDb;
    const classroom = await db.orm.public.Classroom.create({
      tenantId,
      ownerId: teacherA.ownerId,
      name: 'Klasse 3a',
      federalState: 'HE',
      grade: 3,
      subject: 'MATH',
      inviteCodeHash: 'c'.repeat(64),
    });
    classroomId = toClassroomId(classroom.id);
  });

  afterAll(async () => {
    // Assignments go with their class (ON DELETE CASCADE).
    await db.orm.public.Classroom.where({ tenantId }).deleteAndCount();
    await disconnect();
  });

  it('persists, isolates by owner, edits and deletes an assignment', async () => {
    const created = (
      await new PrismaAssignmentRepository(clock).create({ ...teacherA, classroomId, draft })
    )._unsafeUnwrap();

    // A fresh repository stands in for a reload: the row comes from the database.
    const repository = new PrismaAssignmentRepository(clock);
    expect((await repository.findInTenant(created.id, tenantId))._unsafeUnwrap()).toMatchObject({
      ...draft,
      ownerId: teacherA.ownerId,
    });
    expect(
      (await repository.listByClassroom(classroomId, teacherA, 10))._unsafeUnwrap(),
    ).toHaveLength(1);
    expect((await repository.listByClassroom(classroomId, teacherB, 10))._unsafeUnwrap()).toEqual(
      [],
    );

    const foreignUpdate = await repository.update(created.id, teacherB, { ...draft, title: 'X' });
    expect(foreignUpdate.isErr() && foreignUpdate.error.kind).toBe('not_found');
    await repository.deleteById(created.id, teacherB);
    expect((await repository.findById(created.id, teacherA))._unsafeUnwrap()?.title).toBe(
      'Murmeln',
    );

    const updated = await repository.update(created.id, teacherA, {
      ...draft,
      title: 'Neu',
      dueDate: null,
      solutionKey: null,
    });
    expect(updated._unsafeUnwrap()).toMatchObject({
      title: 'Neu',
      dueDate: null,
      solutionKey: null,
    });

    await repository.deleteById(created.id, teacherA);
    expect((await repository.findInTenant(created.id, tenantId))._unsafeUnwrap()).toBeNull();
  });

  it("reads a class's assignments for a child without the solution key", async () => {
    const repository = new PrismaAssignmentRepository(clock);
    const created = (await repository.create({ ...teacherA, classroomId, draft }))._unsafeUnwrap();

    const forChild = (await repository.listForChild(classroomId, tenantId, 10))._unsafeUnwrap();
    expect(forChild).toEqual([
      { id: created.id, classroomId, title: draft.title, text: draft.text, dueDate: draft.dueDate },
    ]);
    expect(JSON.stringify(forChild)).not.toContain('solutionKey');
    expect(
      (
        await repository.listForChild(classroomId, toTenantId('another-tenant'), 10)
      )._unsafeUnwrap(),
    ).toEqual([]);
    await repository.deleteById(toAssignmentId(created.id), teacherA);
  });

  it('lets the database refuse content the domain would refuse too', async () => {
    const repository = new PrismaAssignmentRepository(clock);
    const result = await repository.create({
      ...teacherA,
      classroomId,
      draft: { ...draft, dueDate: 'next week' },
    });
    expect(result.isErr() && result.error.kind).toBe('infrastructure');
  });
});
