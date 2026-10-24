import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toAssignmentId, toClassroomId } from '@modules/assignments/domain/models/ids';
import { PrismaAssignmentRepository } from '@modules/assignments/infrastructure/prisma/prisma-assignment.repository';
import { toActorId, toTenantId } from '@modules/auth';

import type * as Database from '@lib/db';

const query = vi.hoisted(() => ({
  select: vi.fn(),
  where: vi.fn(),
  first: vi.fn(),
  all: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteAndCount: vi.fn(),
}));
vi.mock('@lib/db', async (original) => ({
  ...(await original<typeof Database>()),
  db: { orm: { public: { Assignment: query } } },
}));
const scope = { tenantId: toTenantId('tenant'), ownerId: toActorId('teacher') };
const now = new Date('2026-10-24T12:00:00Z');
const draft = { title: 'Aufgabe', text: 'Text', dueDate: null, solutionKey: 'privat' };
const repository = new PrismaAssignmentRepository({ now: () => now });

describe('PrismaAssignmentRepository ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const method of ['select', 'where', 'orderBy', 'limit'] as const) {
      query[method].mockReturnValue(query);
    }
    query.first.mockResolvedValue(null);
    query.all.mockResolvedValue([]);
    query.update.mockResolvedValue(null);
    query.deleteAndCount.mockResolvedValue(0);
  });

  it('pins a single read to the tenant and teacher', async () => {
    const result = await repository.findById(toAssignmentId('assignment'), scope);
    expect(result.isOk() && result.value).toBe(null);
    expect(query.where).toHaveBeenCalledWith({ id: 'assignment', ...scope });
  });

  it('bounds a class list and pins it to the teacher', async () => {
    expect((await repository.listByClassroom(toClassroomId('class'), scope, 20)).isOk()).toBe(true);
    expect(query.where).toHaveBeenCalledWith({ classroomId: 'class', ...scope });
    expect(query.limit).toHaveBeenCalledWith(20);
  });

  it('refuses an update that matches no owned assignment', async () => {
    const result = await repository.update(toAssignmentId('foreign'), scope, draft);
    expect(result.isErr() && result.error.kind).toBe('not_found');
    expect(query.where).toHaveBeenCalledWith({ id: 'foreign', ...scope });
  });

  it('keeps deletion idempotent while retaining the owner filter', async () => {
    expect((await repository.deleteById(toAssignmentId('foreign'), scope)).isOk()).toBe(true);
    expect(query.where).toHaveBeenCalledWith({ id: 'foreign', ...scope });
  });

  it('translates database failures without leaking the driver exception', async () => {
    query.first.mockRejectedValue(new Error('private driver detail'));
    const result = await repository.findById(toAssignmentId('assignment'), scope);
    expect(result.isErr() && result.error.kind).toBe('infrastructure');
    expect(result.isErr() && result.error.message).not.toContain('private driver detail');
  });

  it('loads within the tenant only, for the owner check of the use case', async () => {
    expect(
      (await repository.findInTenant(toAssignmentId('assignment'), scope.tenantId)).isOk(),
    ).toBe(true);
    expect(query.where).toHaveBeenCalledWith({ id: 'assignment', tenantId: scope.tenantId });
  });

  it('reads a class for a child without ever selecting the solution key', async () => {
    query.all.mockResolvedValue([
      { id: 'a1', classroomId: 'class', title: 'T', taskText: 'Text', dueDate: null },
    ]);
    const result = await repository.listForChild(toClassroomId('class'), scope.tenantId, 50);
    expect(result._unsafeUnwrap()).toEqual([
      { id: 'a1', classroomId: 'class', title: 'T', text: 'Text', dueDate: null },
    ]);
    expect(query.select).toHaveBeenCalledWith('id', 'classroomId', 'title', 'taskText', 'dueDate');
    expect(query.select.mock.calls.flat()).not.toContain('solutionKey');
    expect(query.where).toHaveBeenCalledWith({ classroomId: 'class', tenantId: scope.tenantId });
    expect(query.limit).toHaveBeenCalledWith(50);
  });
});
