import { describe, expect, it } from 'vitest';

import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import type { Actor } from '@modules/auth/domain/models/actor';
import { toActorId } from '@modules/auth/domain/models/ids';
import type { CurrentActorProvider } from '@modules/auth/domain/ports/current-actor-provider.port';
import type { ClassroomDependencies } from '@modules/classroom/application/classroom-dependencies';
import { ArchiveClassroom } from '@modules/classroom/application/commands/archive-classroom';
import { CreateClassroom } from '@modules/classroom/application/commands/create-classroom';
import { JoinClassroom } from '@modules/classroom/application/commands/join-classroom';
import { LeaveClassroom } from '@modules/classroom/application/commands/leave-classroom';
import { RegenerateInviteCode } from '@modules/classroom/application/commands/regenerate-invite-code';
import { RenameClassroom } from '@modules/classroom/application/commands/rename-classroom';
import { GetChildClassroom } from '@modules/classroom/application/queries/get-child-classroom';
import { ListClassroomMembers } from '@modules/classroom/application/queries/list-classroom-members';
import { ListClassrooms } from '@modules/classroom/application/queries/list-classrooms';
import { CLASSROOM_ERROR_CODES } from '@modules/classroom/domain/errors/classroom-errors';
import type { Classroom } from '@modules/classroom/domain/models/classroom';
import { toClassMembershipId, toClassroomId } from '@modules/classroom/domain/models/ids';
import type { ChildProfileAccess } from '@modules/classroom/domain/ports/child-profile-access.port';
import type { ClassroomEvent } from '@modules/classroom/domain/ports/classroom-audit-log.port';
import type { ClassroomRepository } from '@modules/classroom/domain/ports/classroom.repository';
import { cryptoInviteCodeIssuer } from '@modules/classroom/infrastructure/security/crypto-invite-code-issuer';

import { forbiddenError, infrastructureError, notFoundError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { createBrokenRateLimiter, createTestRateLimiter } from '../../support/rate-limiting';
import { clientAt, parent, recordingAudit } from '../auth/fakes';

const NOW = new Date('2026-10-24T12:00:00.000Z');
const MARA = parent();
const OTHER_PARENT = parent({ id: toActorId('parent-2') });
const TEACHER = parent({ id: toActorId('teacher-1'), roles: ['teacher'] });
const OTHER_TEACHER = parent({ id: toActorId('teacher-2'), roles: ['teacher'] });

interface Child {
  readonly id: string;
  readonly ownerId: string;
  displayName: string;
  federalState: string;
  grade: number;
}

/** A world the use cases run in: one signed-in actor at a time, in-memory storage. */
function world() {
  let current: Actor = TEACHER;
  const as = (actor: Actor) => {
    current = actor;
  };
  const currentActor: CurrentActorProvider = { getCurrentActor: () => okAsync(current) };

  const rooms: Array<Classroom & { inviteCodeHash: string }> = [];
  const members: Array<{ classroomId: string; childProfileId: string; joinedAt: Date }> = [];
  const children = new Map<string, Child>([
    [
      'child-1',
      { id: 'child-1', ownerId: MARA.id, displayName: 'Lina', federalState: 'by', grade: 2 },
    ],
    [
      'child-2',
      { id: 'child-2', ownerId: OTHER_PARENT.id, displayName: 'Ben', federalState: 'be', grade: 1 },
    ],
  ]);
  let next = 1;
  const strip = ({ inviteCodeHash: _hash, ...room }: Classroom & { inviteCodeHash: string }) =>
    room;
  const patch = (id: string, change: Partial<Classroom & { inviteCodeHash: string }>) => {
    const index = rooms.findIndex((room) => room.id === id);
    rooms[index] = { ...rooms[index], ...change } as Classroom & { inviteCodeHash: string };
    return okAsync(strip(rooms[index]));
  };

  const classrooms: ClassroomRepository = {
    findById: (id, ownerId, tenantId) => {
      const room = rooms.find(
        (row) => row.id === id && row.tenantId === tenantId && row.ownerId === ownerId,
      );
      return okAsync(room ? strip(room) : null);
    },
    findActiveByInviteCodeHash: (hash) => {
      const room = rooms.find((row) => row.inviteCodeHash === hash && row.status === 'active');
      return okAsync(room ? strip(room) : null);
    },
    listByOwner: (tenantId, ownerId, limit) =>
      okAsync(
        rooms
          .filter((row) => row.tenantId === tenantId && row.ownerId === ownerId)
          .slice(0, limit)
          .map(strip),
      ),
    create: ({ tenantId, ownerId, draft, inviteCodeHash }) => {
      const room = {
        id: toClassroomId(`class-${String(next++)}`),
        tenantId,
        ownerId,
        ...draft,
        status: 'active' as const,
        inviteCodeHash,
        inviteCodeIssuedAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      };
      rooms.push(room);
      return okAsync(strip(room));
    },
    rename: (id, _scope, name) => patch(id, { name }),
    replaceInviteCode: (id, _scope, inviteCodeHash) => patch(id, { inviteCodeHash }),
    archive: (id) => {
      for (let index = members.length - 1; index >= 0; index -= 1) {
        if (members[index]!.classroomId === id) {
          members.splice(index, 1);
        }
      }
      return patch(id, { status: 'archived' });
    },
    findMembershipOfChild: (childProfileId) => {
      const member = members.find((row) => row.childProfileId === childProfileId);
      const room = member && rooms.find((row) => row.id === member.classroomId);
      return okAsync(member && room ? { classroom: strip(room), joinedAt: member.joinedAt } : null);
    },
    addMember: ({ classroomId, childProfileId, inviteCodeHash }) => {
      const room = rooms.find((row) => row.id === classroomId);
      if (room?.status !== 'active' || room.inviteCodeHash !== inviteCodeHash) {
        return errAsync(notFoundError(CLASSROOM_ERROR_CODES.inviteCodeInvalid, ''));
      }
      if (members.some((row) => row.childProfileId === childProfileId)) {
        return errAsync({
          kind: 'conflict',
          code: CLASSROOM_ERROR_CODES.childAlreadyInClassroom,
          message: '',
        });
      }
      members.push({ classroomId, childProfileId, joinedAt: NOW });
      return okAsync(NOW);
    },
    removeMemberOfChild: (childProfileId) => {
      const index = members.findIndex((row) => row.childProfileId === childProfileId);
      if (index >= 0) {
        members.splice(index, 1);
      }
      return okAsync(index >= 0);
    },
    listMembers: (classroomId, _scope, limit) =>
      okAsync(
        members
          .filter((row) => row.classroomId === classroomId)
          .slice(0, limit)
          .map((row) => ({
            memberId: toClassMembershipId(`membership-${row.childProfileId}`),
            displayName: children.get(row.childProfileId)!.displayName,
            joinedAt: row.joinedAt,
          })),
      ),
  };

  /** Behaves like the learner module: another parent's child is refused, an unknown one not found. */
  let adoptFails = false;
  const ownChild = (id: string) => {
    const child = children.get(id);
    if (child === undefined) {
      return errAsync(notFoundError('child_profile.not_found', ''));
    }
    return child.ownerId === current.id
      ? okAsync(child)
      : errAsync(forbiddenError('auth.permission_denied', ''));
  };
  const childProfiles: ChildProfileAccess = {
    requireOwnChild: (id) => ownChild(id).map(() => undefined),
    adoptClassroomSettings: (id, settings) =>
      adoptFails
        ? errAsync(infrastructureError('learner.persistence_failed', ''))
        : ownChild(id).map((child) => {
            child.federalState = settings.federalState;
            child.grade = settings.grade;
          }),
  };

  const events: ClassroomEvent[] = [];
  const deps = (overrides: Partial<ClassroomDependencies> = {}): ClassroomDependencies => ({
    authorization: createAuthorizationService({ currentActor, audit: recordingAudit() }),
    classrooms,
    inviteCodes: cryptoInviteCodeIssuer,
    childProfiles,
    audit: { record: (event) => events.push(event) },
    rateLimiter: createTestRateLimiter(),
    clientAddress: clientAt('203.0.113.7'),
    ...overrides,
  });
  const base = deps();
  return {
    as,
    rooms,
    members,
    children,
    events,
    deps,
    failAdopt: () => {
      adoptFails = true;
    },
    create: new CreateClassroom(base),
    rename: new RenameClassroom(base),
    archive: new ArchiveClassroom(base),
    regenerate: new RegenerateInviteCode(base),
    join: new JoinClassroom(base),
    leave: new LeaveClassroom(base),
    list: new ListClassrooms(base),
    listMembers: new ListClassroomMembers(base),
    childClassroom: new GetChildClassroom(base),
  };
}

const CLASS_3A = { name: 'Klasse 3a', federalState: 'he', grade: 3, subject: 'math' };

async function classWithCode(w: ReturnType<typeof world>, teacher: Actor = TEACHER) {
  w.as(teacher);
  const created = (await w.create.execute(CLASS_3A))._unsafeUnwrap();
  return { id: created.classroom.id, code: created.inviteCode };
}

describe('teacher classes', () => {
  it('creates a class with a readable invite code and stores only its hash', async () => {
    const w = world();
    const { code } = await classWithCode(w);

    expect(code).toMatch(/^[ACDEFHJKMNPRTUVWXY34679]{4}-[ACDEFHJKMNPRTUVWXY34679]{4}$/);
    expect(w.rooms[0]!.inviteCodeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(w.rooms)).not.toContain(code.replace('-', ''));
    expect(JSON.stringify(w.events)).not.toContain('Klasse 3a');
  });

  it('lists only the teacher’s own classes', async () => {
    const w = world();
    await classWithCode(w, TEACHER);
    await classWithCode(w, OTHER_TEACHER);

    w.as(TEACHER);
    const own = (await w.list.execute())._unsafeUnwrap();
    expect(own).toHaveLength(1);
  });

  it('refuses a class that breaks the rules', async () => {
    const w = world();
    const result = await w.create.execute({ ...CLASS_3A, grade: 5, subject: 'latin' });

    expect(result._unsafeUnwrapErr().code).toBe(CLASSROOM_ERROR_CODES.validationFailed);
  });

  it('does not let a parent create a class', async () => {
    const w = world();
    w.as(MARA);
    const result = await w.create.execute(CLASS_3A);

    expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
  });

  it('renames and archives its own class, and an archived class takes no new name or code', async () => {
    const w = world();
    const { id } = await classWithCode(w);

    expect((await w.rename.execute({ id, name: ' Klasse 3b ' }))._unsafeUnwrap().name).toBe(
      'Klasse 3b',
    );
    expect((await w.archive.execute({ id }))._unsafeUnwrap().status).toBe('archived');
    expect((await w.rename.execute({ id, name: 'x' }))._unsafeUnwrapErr().code).toBe(
      CLASSROOM_ERROR_CODES.archived,
    );
    expect((await w.regenerate.execute({ id }))._unsafeUnwrapErr().code).toBe(
      CLASSROOM_ERROR_CODES.archived,
    );
  });

  it('refuses another teacher’s class for rename, archive, new code and member list', async () => {
    const w = world();
    const { id } = await classWithCode(w, TEACHER);

    w.as(OTHER_TEACHER);
    for (const result of [
      await w.rename.execute({ id, name: 'mine now' }),
      await w.archive.execute({ id }),
      await w.regenerate.execute({ id }),
      await w.listMembers.execute(id),
    ]) {
      expect(result._unsafeUnwrapErr().kind).toBe('not_found');
    }
  });
});

describe('joining with an invite code', () => {
  it('puts the child in the class and copies federal state and grade from the class', async () => {
    const w = world();
    const { id, code } = await classWithCode(w);

    w.as(MARA);
    const joined = await w.join.execute({
      childProfileId: 'child-1',
      inviteCode: ` ${code.toLowerCase()} `,
    });

    expect(joined._unsafeUnwrap()).toMatchObject({ classroomId: id, grade: 3, federalState: 'he' });
    expect(w.children.get('child-1')).toMatchObject({ federalState: 'he', grade: 3 });
    expect((await w.childClassroom.execute('child-1'))._unsafeUnwrap()?.classroomId).toBe(id);
  });

  it('shows the teacher only display name and join date of the children in their own class', async () => {
    const w = world();
    const { id, code } = await classWithCode(w);
    const foreign = await classWithCode(w, OTHER_TEACHER);
    w.as(MARA);
    await w.join.execute({ childProfileId: 'child-1', inviteCode: code });
    w.as(OTHER_PARENT);
    await w.join.execute({ childProfileId: 'child-2', inviteCode: foreign.code });

    w.as(TEACHER);
    const listed = (await w.listMembers.execute(id))._unsafeUnwrap();
    expect(listed).toEqual([
      { memberId: 'membership-child-1', displayName: 'Lina', joinedAt: NOW },
    ]);
    expect(Object.keys(listed[0]!)).toEqual(['memberId', 'displayName', 'joinedAt']);
    expect(JSON.stringify(listed)).not.toContain('"child-1"');
    expect((await w.listMembers.execute(foreign.id))._unsafeUnwrapErr().kind).toBe('not_found');
  });

  it('refuses a code replaced between the lookup and the membership write', async () => {
    const w = world();
    const { id, code } = await classWithCode(w);
    const { classrooms } = w.deps();
    // The teacher issues a new code right after the parent's code was looked up.
    const racing = new JoinClassroom(
      w.deps({
        classrooms: {
          ...classrooms,
          findActiveByInviteCodeHash: (hash, tenantId) =>
            classrooms.findActiveByInviteCodeHash(hash, tenantId).andThen((found) => {
              const room = w.rooms.find((row) => row.id === id)!;
              room.inviteCodeHash = 'f'.repeat(64);
              return okAsync(found);
            }),
        },
      }),
    );
    w.as(MARA);

    const result = await racing.execute({ childProfileId: 'child-1', inviteCode: code });

    expect(result._unsafeUnwrapErr().code).toBe(CLASSROOM_ERROR_CODES.inviteCodeInvalid);
    expect(w.members).toHaveLength(0);
    expect(w.children.get('child-1')).toMatchObject({ federalState: 'by', grade: 2 });
    expect(w.events).toContainEqual(
      expect.objectContaining({ type: 'classroom.join_refused', reason: 'invite_code_invalid' }),
    );
  });

  it('rejects an unknown or malformed code, and audits it without the code', async () => {
    const w = world();
    await classWithCode(w);
    w.as(MARA);

    for (const inviteCode of ['AAAA-AAAA', 'not a code', '0000-0000']) {
      const result = await w.join.execute({ childProfileId: 'child-1', inviteCode });
      expect(result._unsafeUnwrapErr().code).toBe(CLASSROOM_ERROR_CODES.inviteCodeInvalid);
    }
    expect(w.members).toHaveLength(0);
    expect(w.events.filter((event) => event.type === 'classroom.join_refused')).toHaveLength(3);
    expect(JSON.stringify(w.events)).not.toContain('AAAA');
  });

  it('rejects the old code once a new one was issued, and accepts the new one', async () => {
    const w = world();
    const { id, code: oldCode } = await classWithCode(w);
    const newCode = (await w.regenerate.execute({ id }))._unsafeUnwrap().inviteCode;

    w.as(MARA);
    const old = await w.join.execute({ childProfileId: 'child-1', inviteCode: oldCode });
    expect(old._unsafeUnwrapErr().code).toBe(CLASSROOM_ERROR_CODES.inviteCodeInvalid);
    const fresh = await w.join.execute({ childProfileId: 'child-1', inviteCode: newCode });
    expect(fresh.isOk()).toBe(true);
  });

  it('rejects the code of an archived class and ends its memberships', async () => {
    const w = world();
    const { id, code } = await classWithCode(w);
    w.as(MARA);
    await w.join.execute({ childProfileId: 'child-1', inviteCode: code });

    w.as(TEACHER);
    await w.archive.execute({ id });
    expect(w.members).toHaveLength(0);

    w.as(MARA);
    const result = await w.join.execute({ childProfileId: 'child-1', inviteCode: code });
    expect(result._unsafeUnwrapErr().code).toBe(CLASSROOM_ERROR_CODES.inviteCodeInvalid);
  });

  it('lets a parent link and remove only their own child', async () => {
    const w = world();
    const { code } = await classWithCode(w);
    w.as(OTHER_PARENT);
    await w.join.execute({ childProfileId: 'child-2', inviteCode: code });

    w.as(MARA);
    const join = await w.join.execute({ childProfileId: 'child-2', inviteCode: code });
    const leave = await w.leave.execute({ childProfileId: 'child-2' });
    const read = await w.childClassroom.execute('child-2');
    const unknown = await w.join.execute({ childProfileId: 'child-9', inviteCode: code });

    expect(join._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(leave._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(read._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(unknown._unsafeUnwrapErr().kind).toBe('not_found');
    expect(w.members).toEqual([expect.objectContaining({ childProfileId: 'child-2' })]);
  });

  it('removes the own child from its class', async () => {
    const w = world();
    const { code } = await classWithCode(w);
    w.as(MARA);
    await w.join.execute({ childProfileId: 'child-1', inviteCode: code });

    expect((await w.leave.execute({ childProfileId: 'child-1' })).isOk()).toBe(true);
    expect(w.members).toHaveLength(0);
    expect((await w.childClassroom.execute('child-1'))._unsafeUnwrap()).toBeNull();
    expect(w.events.some((event) => event.type === 'classroom.child_left')).toBe(true);
  });

  it('keeps a child in one class: the same class again is fine, another one is refused', async () => {
    const w = world();
    const first = await classWithCode(w);
    const second = await classWithCode(w, OTHER_TEACHER);
    w.as(MARA);
    await w.join.execute({ childProfileId: 'child-1', inviteCode: first.code });

    const again = await w.join.execute({ childProfileId: 'child-1', inviteCode: first.code });
    const other = await w.join.execute({ childProfileId: 'child-1', inviteCode: second.code });

    expect(again.isOk()).toBe(true);
    expect(other._unsafeUnwrapErr().code).toBe(CLASSROOM_ERROR_CODES.childAlreadyInClassroom);
    expect(w.members).toEqual([expect.objectContaining({ classroomId: first.id })]);
  });

  it('takes the membership back when the profile cannot be updated', async () => {
    const w = world();
    const { code } = await classWithCode(w);
    w.failAdopt();
    w.as(MARA);

    const result = await w.join.execute({ childProfileId: 'child-1', inviteCode: code });

    expect(result._unsafeUnwrapErr().kind).toBe('infrastructure');
    expect(w.members).toHaveLength(0);
  });

  it('does not let a teacher join a child', async () => {
    const w = world();
    const { code } = await classWithCode(w);
    const result = await w.join.execute({ childProfileId: 'child-1', inviteCode: code });

    expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
  });
});

describe('the join budget', () => {
  it('refuses attempts after ten per parent and hour, counting parents apart', async () => {
    const w = world();
    const join = new JoinClassroom(w.deps());
    w.as(MARA);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await join.execute({ childProfileId: 'child-1', inviteCode: 'AAAA-AAAA' });
    }
    const refused = await join.execute({ childProfileId: 'child-1', inviteCode: 'AAAA-AAAA' });
    w.as(OTHER_PARENT);
    const other = await join.execute({ childProfileId: 'child-2', inviteCode: 'AAAA-AAAA' });

    expect(refused._unsafeUnwrapErr().code).toBe(CLASSROOM_ERROR_CODES.rateLimited);
    expect(other._unsafeUnwrapErr().code).toBe(CLASSROOM_ERROR_CODES.inviteCodeInvalid);
  });

  it('refuses every attempt when the limiter store is down', async () => {
    const w = world();
    const { code } = await classWithCode(w);
    const join = new JoinClassroom(w.deps({ rateLimiter: createBrokenRateLimiter() }));
    w.as(MARA);

    const result = await join.execute({ childProfileId: 'child-1', inviteCode: code });

    expect(result._unsafeUnwrapErr().code).toBe(CLASSROOM_ERROR_CODES.rateLimiterFailed);
    expect(w.members).toHaveLength(0);
  });
});
