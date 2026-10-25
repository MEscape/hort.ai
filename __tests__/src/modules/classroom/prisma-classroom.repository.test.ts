import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth';
import { toChildProfileId, toClassroomId } from '@modules/classroom/domain/models/ids';
import { PrismaClassroomRepository } from '@modules/classroom/infrastructure/prisma/prisma-classroom.repository';

import { dateToInstant } from '@lib/db';
import type * as Database from '@lib/db';

const query = vi.hoisted(() => ({
  select: vi.fn(),
  where: vi.fn(),
  first: vi.fn(),
  update: vi.fn(),
  updateAndCount: vi.fn(),
  create: vi.fn(),
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
  query.updateAndCount.mockResolvedValue(0);
  query.all.mockResolvedValue([]);
});

describe('classroom persistence ownership', () => {
  it('pins teacher reads to the authenticated owner', async () => {
    expect((await repository.findById(id, ownerId, tenantId))._unsafeUnwrap()).toBeNull();
    expect(query.where).toHaveBeenCalledWith({ id, tenantId, ownerId });
  });

  it('pins rename to the owner at write time', async () => {
    const result = await repository.rename(id, { tenantId, ownerId }, 'new value');
    expect(result._unsafeUnwrapErr().kind).toBe('not_found');
    expect(query.where).toHaveBeenCalledWith({ id, tenantId, ownerId });
  });

  it('pins replaceInviteCode to the owner at write time', async () => {
    const result = await repository.replaceInviteCode(
      id,
      { tenantId, ownerId },
      { hash: 'a'.repeat(64), sealed: null },
    );
    expect(result._unsafeUnwrapErr().kind).toBe('not_found');
    expect(query.where).toHaveBeenCalledWith({ id, tenantId, ownerId });
  });

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

  it('lists members by membership id, never by child profile id', async () => {
    query.all.mockResolvedValue([
      {
        id: 'membership-1',
        joinedAt: dateToInstant(new Date('2026-10-01T08:00:00Z')),
        childProfile: { displayName: 'Lina' },
      },
    ]);

    const listed = (await repository.listMembers(id, { tenantId, ownerId }, 20))._unsafeUnwrap();

    expect(listed).toEqual([
      { memberId: 'membership-1', displayName: 'Lina', joinedAt: new Date('2026-10-01T08:00:00Z') },
    ]);
    expect(query.select).toHaveBeenCalledWith('id', 'joinedAt');
  });
});

/** The predicates passed to `.where(fn)`, applied to a row whose `inviteCodeIssuedAt` is spied. */
function issuedAtBounds(): unknown[] {
  const gte = vi.fn();
  for (const [argument] of query.where.mock.calls) {
    if (typeof argument === 'function') {
      argument({ inviteCodeIssuedAt: { gte } });
    }
  }
  return gte.mock.calls.map(([bound]) => bound);
}

describe('invite code validity', () => {
  const hash = 'a'.repeat(64);
  /** 14 days before the repository clock. */
  const validSince = dateToInstant(new Date('2026-10-10T12:00:00Z'));

  it('finds a class only by an unexpired code', async () => {
    expect(
      (await repository.findActiveByInviteCodeHash(hash, tenantId))._unsafeUnwrap(),
    ).toBeNull();

    expect(query.where).toHaveBeenCalledWith({ inviteCodeHash: hash, tenantId, status: 'ACTIVE' });
    expect(issuedAtBounds()).toEqual([validSince]);
  });

  it('re-checks code and expiry under the class lock and adds nothing when they changed', async () => {
    const result = await repository.addMember({
      tenantId,
      classroomId: id,
      childProfileId: toChildProfileId('child'),
      inviteCodeHash: hash,
    });

    expect(result._unsafeUnwrapErr().code).toBe('classroom.invite_code_invalid');
    expect(query.where).toHaveBeenCalledWith({
      id,
      tenantId,
      inviteCodeHash: hash,
      status: 'ACTIVE',
    });
    expect(issuedAtBounds()).toEqual([validSince]);
    expect(query.create).not.toHaveBeenCalled();
  });

  it('adds the member while the locked class still carries the code', async () => {
    query.updateAndCount.mockResolvedValue(1);
    query.create.mockResolvedValue({ joinedAt: dateToInstant(new Date('2026-10-24T12:00:00Z')) });

    const result = await repository.addMember({
      tenantId,
      classroomId: id,
      childProfileId: toChildProfileId('child'),
      inviteCodeHash: hash,
    });

    expect(result._unsafeUnwrap()).toEqual(new Date('2026-10-24T12:00:00Z'));
    expect(query.create).toHaveBeenCalledWith({
      tenantId,
      classroomId: id,
      childProfileId: 'child',
    });
  });
});
