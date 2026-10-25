// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CreateAssignment } from '@modules/assignments/application/commands/create-assignment';
import { DeleteAssignment } from '@modules/assignments/application/commands/delete-assignment';
import { UpdateAssignment } from '@modules/assignments/application/commands/update-assignment';
import { GetAssignmentForHelp } from '@modules/assignments/application/queries/get-assignment-for-help';
import { GetTeacherAssignmentOverview } from '@modules/assignments/application/queries/get-teacher-assignment-overview';
import { ListChildAssignments } from '@modules/assignments/application/queries/list-child-assignments';
import { ClassroomModuleAccess } from '@modules/assignments/infrastructure/classroom/classroom-module-access';
import { PrismaAssignmentRepository } from '@modules/assignments/infrastructure/prisma/prisma-assignment.repository';
import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import type { Actor } from '@modules/auth/domain/models/actor';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import { PARENT_ROLE, TEACHER_ROLE } from '@modules/auth/domain/models/role';
import { CreateClassroom } from '@modules/classroom/application/commands/create-classroom';
import { JoinClassroom } from '@modules/classroom/application/commands/join-classroom';
import { LeaveClassroom } from '@modules/classroom/application/commands/leave-classroom';
import { RegenerateInviteCode } from '@modules/classroom/application/commands/regenerate-invite-code';
import { GetChildClassroom } from '@modules/classroom/application/queries/get-child-classroom';
import { GetClassroomById } from '@modules/classroom/application/queries/get-classroom-by-id';
import { ListClassrooms } from '@modules/classroom/application/queries/list-classrooms';
import { LearnerChildProfileAccess } from '@modules/classroom/infrastructure/learner/learner-child-profile-access';
import { PrismaClassroomRepository } from '@modules/classroom/infrastructure/prisma/prisma-classroom.repository';
import { createAesGcmInviteCodeVault } from '@modules/classroom/infrastructure/security/aes-gcm-invite-code-vault';
import { cryptoInviteCodeIssuer } from '@modules/classroom/infrastructure/security/crypto-invite-code-issuer';
import { AdoptSchoolSettings } from '@modules/learner/application/commands/adopt-school-settings';
import { GetChildProfileById } from '@modules/learner/application/queries/get-child-profile-by-id';
import { PrismaChildProfileRepository } from '@modules/learner/infrastructure/prisma/prisma-child-profile.repository';

import type { db as Db } from '@lib/db';

import { createTestRateLimiter } from '../../support/rate-limiting';
import { recordingAudit, signedInAs, UNRESOLVED_CLIENT } from '../auth/fakes';

/**
 * The whole #33 journey against the real tables (local Postgres after `npm run db:migrate`; skipped
 * without a `DATABASE_URL`): the production use cases, repositories and cross-module adapters of the
 * assignments, classroom and learner modules. Only who is signed in and the rate-limit store are
 * test doubles. Every row lives in a tenant of this run and is removed afterwards.
 */
const isEnabled = Boolean(process.env['DATABASE_URL']);

interface ResultLike<T> {
  isOk(): boolean;
  _unsafeUnwrap(): T;
  _unsafeUnwrapErr(): unknown;
}

/** The value of a result; a failure names its error, so a red test says what went wrong. */
function value<T>(result: ResultLike<T>): T {
  if (!result.isOk()) {
    throw new Error(JSON.stringify(result._unsafeUnwrapErr()));
  }
  return result._unsafeUnwrap();
}

/** The error code of a result that must have failed. */
function codeOf(result: ResultLike<unknown>): string | undefined {
  return result.isOk() ? undefined : (result._unsafeUnwrapErr() as { code: string }).code;
}

const BLANK = { title: 't', taskText: 't', dueDate: '', solutionKey: '' };

describe.skipIf(!isEnabled)('teacher assignments reach the children of the class', () => {
  const tenantId = toTenantId(
    `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const actor = (id: string, role: typeof PARENT_ROLE | typeof TEACHER_ROLE): Actor => ({
    id: toActorId(id),
    tenantId,
    roles: [role],
  });
  const teacherA = actor('teacher-a', TEACHER_ROLE);
  const teacherB = actor('teacher-b', TEACHER_ROLE);
  const parentA = actor('parent-a', PARENT_ROLE);
  const parentB = actor('parent-b', PARENT_ROLE);
  const parentC = actor('parent-c', PARENT_ROLE);
  const clock = { now: () => new Date() };
  const rateLimiter = createTestRateLimiter();
  const noAudit = { record: () => undefined };
  let db: typeof Db;
  let disconnect: () => Promise<void>;

  /** Everything one signed-in person reaches, built like the composition roots build it. */
  function as(signedIn: Actor) {
    const authorization = createAuthorizationService({
      currentActor: signedInAs(signedIn),
      audit: recordingAudit(),
    });
    const learner = {
      authorization,
      childProfiles: new PrismaChildProfileRepository(),
      audit: noAudit,
      tutors: { isSelectable: () => true },
      isDevResetAllowed: false,
      clock,
    };
    const classroom = {
      authorization,
      classrooms: new PrismaClassroomRepository(clock),
      inviteCodes: cryptoInviteCodeIssuer,
      inviteCodeVault: createAesGcmInviteCodeVault(undefined),
      childProfiles: new LearnerChildProfileAccess({
        getChildProfileById: new GetChildProfileById(learner),
        adoptSchoolSettings: new AdoptSchoolSettings(learner),
      }),
      audit: noAudit,
      rateLimiter,
      clientAddress: UNRESOLVED_CLIENT,
      clock,
    };
    const assignments = {
      authorization,
      assignments: new PrismaAssignmentRepository(clock),
      classrooms: new ClassroomModuleAccess({
        listClassrooms: new ListClassrooms(classroom),
        getClassroomById: new GetClassroomById(classroom),
        getChildClassroom: new GetChildClassroom(classroom),
      }),
      audit: noAudit,
      clock,
    };
    return {
      createClassroom: new CreateClassroom(classroom),
      newCode: new RegenerateInviteCode(classroom),
      join: new JoinClassroom(classroom),
      leave: new LeaveClassroom(classroom),
      overview: new GetTeacherAssignmentOverview(assignments),
      create: new CreateAssignment(assignments),
      update: new UpdateAssignment(assignments),
      remove: new DeleteAssignment(assignments),
      childTasks: new ListChildAssignments(assignments),
      forHelp: new GetAssignmentForHelp(assignments),
    };
  }

  /** The parent's one child profile (the MVP allows one unfinished profile per parent). */
  async function childOf(parent: Actor, displayName: string) {
    const saved = value(
      await new PrismaChildProfileRepository().saveUnfinished({
        tenantId,
        ownerId: parent.id,
        details: { displayName, federalState: 'HE', grade: 3 },
      }),
    );
    if (saved === null) {
      throw new Error('child profile was not saved');
    }
    return saved.profile.id;
  }

  async function newClassroom(name: string) {
    return value(
      await as(teacherA).createClassroom.execute({
        name,
        federalState: 'he',
        grade: 3,
        subject: 'math',
      }),
    );
  }

  beforeAll(async () => {
    const database = await import('@lib/db');
    db = database.db;
    disconnect = database.disconnectDb;
  });

  afterAll(async () => {
    await db.orm.public.ChildProfile.where({ tenantId }).deleteAndCount();
    await db.orm.public.Classroom.where({ tenantId }).deleteAndCount();
    await disconnect();
  });

  it('runs from a new class to the child seeing the task, without the solution key', async () => {
    const teacher = as(teacherA);
    const created = await newClassroom('Klasse 3a');
    const classroomId = created.classroom.id;
    const draft = { title: 'Murmeln', taskText: '36 Murmeln an 4 Kinder', dueDate: '2026-11-02' };
    const posted = value(
      await teacher.create.execute({ ...draft, classroomId, solutionKey: '9 Murmeln' }),
    );

    // A new set of use cases reads only what the database kept: the "reload".
    expect(value(await as(teacherA).overview.execute(classroomId))).toMatchObject({
      selectedClassroomId: classroomId,
      assignments: [{ id: posted.id, title: 'Murmeln', solutionKey: '9 Murmeln' }],
    });
    value(
      await teacher.update.execute({
        ...draft,
        id: posted.id,
        title: 'Murmeln teilen',
        solutionKey: '9',
      }),
    );

    const parent = as(parentA);
    const child = await childOf(parentA, 'Mia');
    expect(value(await parent.childTasks.execute(child))).toEqual([]);

    const joined = value(
      await parent.join.execute({ childProfileId: child, inviteCode: created.inviteCode }),
    );
    expect(joined).toMatchObject({ classroomId, name: 'Klasse 3a' });
    const tasks = value(await parent.childTasks.execute(child));
    expect(tasks).toEqual([
      { id: posted.id, title: 'Murmeln teilen', taskText: draft.taskText, dueDate: draft.dueDate },
    ]);
    expect(JSON.stringify(tasks)).not.toContain('solutionKey');

    value(await teacher.remove.execute({ id: posted.id }));
    expect(value(await parent.childTasks.execute(child))).toEqual([]);
  });

  it('refuses wrong roles, foreign children and classes, cross-teacher access and stale codes', async () => {
    const teacher = as(teacherA);
    const created = await newClassroom('Klasse 3b');
    const classroomId = created.classroom.id;
    const posted = value(
      await teacher.create.execute({ ...BLANK, classroomId, title: 'Plus', solutionKey: '603' }),
    );

    // Wrong role: a parent cannot post; a teacher cannot read a child's tasks.
    expect(codeOf(await as(parentA).create.execute({ ...BLANK, classroomId }))).toBe(
      'auth.permission_denied',
    );
    // Foreign classroom and another teacher's assignment.
    const asB = as(teacherB);
    expect(codeOf(await asB.create.execute({ ...BLANK, classroomId }))).toBe('classroom.not_found');
    expect(codeOf(await asB.update.execute({ ...BLANK, id: posted.id }))).toBe(
      'auth.permission_denied',
    );
    expect(value(await asB.overview.execute(classroomId)).assignments).toEqual([]);

    // A foreign child: parent A can neither enrol nor read parent B's child.
    const child = await childOf(parentB, 'Ben');
    const asParentA = as(parentA);
    expect(
      codeOf(
        await asParentA.join.execute({ childProfileId: child, inviteCode: created.inviteCode }),
      ),
    ).toBeDefined();
    expect(codeOf(await asParentA.childTasks.execute(child))).toBeDefined();
    expect(codeOf(await teacher.childTasks.execute(child))).toBe('auth.permission_denied');

    // A replaced or invalid code is refused with one answer.
    const fresh = value(await teacher.newCode.execute({ id: classroomId }));
    const parent = as(parentB);
    for (const inviteCode of [created.inviteCode, 'NOPE-NOPE']) {
      expect(codeOf(await parent.join.execute({ childProfileId: child, inviteCode }))).toBe(
        'classroom.invite_code_invalid',
      );
    }

    // No membership, nothing to see. Joining twice is harmless; leaving ends access.
    expect(value(await parent.childTasks.execute(child))).toEqual([]);
    value(await parent.join.execute({ childProfileId: child, inviteCode: fresh.inviteCode }));
    value(await parent.join.execute({ childProfileId: child, inviteCode: fresh.inviteCode }));
    expect(value(await parent.childTasks.execute(child)).map(({ id }) => id)).toEqual([posted.id]);
    value(await parent.leave.execute({ childProfileId: child }));
    expect(value(await parent.childTasks.execute(child))).toEqual([]);
  });

  it('gives the key for the help on an assignment only while the child is in the class (#33)', async () => {
    const teacher = as(teacherA);
    const created = await newClassroom('Klasse 3c');
    const other = await newClassroom('Klasse 3d');
    const posted = value(
      await teacher.create.execute({
        ...BLANK,
        classroomId: created.classroom.id,
        taskText: 'Rechne 36 + 47.',
        solutionKey: '83',
      }),
    );
    const elsewhere = value(
      await teacher.create.execute({ ...BLANK, classroomId: other.classroom.id, solutionKey: '1' }),
    );
    const parent = as(parentC);
    const child = await childOf(parentC, 'Emil');
    const forHelp = (assignmentId: string, signedIn = parent) =>
      signedIn.forHelp.execute({ childProfileId: child, assignmentId });

    expect(codeOf(await forHelp(posted.id))).toBe('assignments.not_found');

    value(await parent.join.execute({ childProfileId: child, inviteCode: created.inviteCode }));
    expect(value(await forHelp(posted.id))).toEqual({
      id: posted.id,
      taskText: 'Rechne 36 + 47.',
      solutionKey: '83',
    });
    // Another class's assignment, another parent, a teacher: refused.
    expect(codeOf(await forHelp(elsewhere.id))).toBe('assignments.not_found');
    expect(codeOf(await forHelp(posted.id, as(parentA)))).toBeDefined();
    expect(codeOf(await forHelp(posted.id, teacher))).toBe('auth.permission_denied');

    value(await parent.leave.execute({ childProfileId: child }));
    expect(codeOf(await forHelp(posted.id))).toBe('assignments.not_found');
  });
});
