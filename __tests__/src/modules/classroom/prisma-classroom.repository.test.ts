import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth';
import { toClassroomId } from '@modules/classroom/domain/models/ids';
import { PrismaClassroomRepository } from '@modules/classroom/infrastructure/prisma/prisma-classroom.repository';

import type * as Database from '@lib/db';

const query = vi.hoisted(() => ({
  select: vi.fn(),
  where: vi.fn(),
  first: vi.fn(),
  update: vi.fn(),
  deleteAndCount: vi.fn(),
  include: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  all: vi.fn(),
}));
vi.mock('@lib/db', async (original) => ({
  ...(await original<typeof Database>()),
  db: {
    orm: { public: { Classroom: query, ClassMembership: query } },
    transaction: (run: (tx: unknown) => Promise<unknown>) =>
      run({ orm: { public: { Classroom: query, ClassMembership: query } } }),
  },
}));
const tenantId = toTenantId('tenant');
const ownerId = toActorId('teacher');
const id = toClassroomId('class');
const repository = new PrismaClassroomRepository({ now: () => new Date('2026-10-24T12:00:00Z') });

beforeEach(() => {
  vi.clearAllMocks();
  for (const method of ['select', 'where', 'include', 'orderBy', 'limit'] as const) {
    query[method].mockReturnValue(query);
  }
  query.first.mockResolvedValue(null);
  query.update.mockResolvedValue(null);
  query.all.mockResolvedValue([]);
});

describe('classroom persistence ownership', () => {
  it('pins teacher reads to the authenticated owner', async () => {
    expect((await repository.findById(id, ownerId, tenantId))._unsafeUnwrap()).toBeNull();
    expect(query.where).toHaveBeenCalledWith({ id, tenantId, ownerId });
  });

  it.each(['rename', 'replaceInviteCode'] as const)(
    'pins %s to the owner at write time',
    async (method) => {
      const result = await repository[method](id, { tenantId, ownerId }, 'new value');
      expect(result._unsafeUnwrapErr().kind).toBe('not_found');
      expect(query.where).toHaveBeenCalledWith({ id, tenantId, ownerId });
    },
  );

  it('does not delete memberships when the owner-scoped archive misses', async () => {
    expect((await repository.archive(id, tenantId, ownerId))._unsafeUnwrapErr().kind).toBe(
      'not_found',
    );
    expect(query.where).toHaveBeenCalledWith({ id, tenantId, ownerId });
    expect(query.deleteAndCount).not.toHaveBeenCalled();
  });

  it('pins the member list through its classroom owner', async () => {
    expect((await repository.listMembers(id, { tenantId, ownerId }, 20))._unsafeUnwrap()).toEqual(
      [],
    );
    expect(query.where).toHaveBeenCalledWith({ classroomId: id, tenantId });
    const predicate = query.where.mock.calls
      .map(([argument]) => argument)
      .find((argument) => typeof argument === 'function');
    expect(predicate).toBeTypeOf('function');
    const some = vi.fn();
    predicate({ classroom: { some } });
    expect(some).toHaveBeenCalledWith({ tenantId, ownerId });
    expect(query.limit).toHaveBeenCalledWith(20);
  });
});
