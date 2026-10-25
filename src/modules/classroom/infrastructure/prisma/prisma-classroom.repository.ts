import type { ActorId, TenantId } from '@modules/auth';

import type { Clock } from '@lib/clock';
import { db, createPersistenceFailures } from '@lib/db';
import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  CLASSROOM_ERROR_CODES,
  childAlreadyInClassroom,
  classroomNotFound,
  inviteCodeInvalid,
} from '../../domain/errors/classroom-errors';
import { inviteCodeValidSince } from '../../domain/models/invite-code';

import {
  CHILD_DISPLAY_NAME_SELECT,
  CLASS_MEMBER_SELECT,
  CLASSROOM_SELECT,
  CLASSROOM_STATUS_RECORD,
  JOINED_AT_SELECT,
  instantOf,
  toChildMembership,
  toClassMember,
  toClassroom,
  toClassroomCreateData,
  toJoinedAt,
  touched,
} from './classroom-record-mapper';

import type { Classroom } from '../../domain/models/classroom';
import type { ChildProfileId, ClassroomId } from '../../domain/models/ids';
import type {
  ChildMembership,
  ClassMember,
  ClassroomRepository,
  ClassroomOwnerScope,
  NewClassroom,
  NewMembership,
} from '../../domain/ports/classroom.repository';

const failures = createPersistenceFailures({
  module: 'classroom.persistence',
  code: CLASSROOM_ERROR_CODES.persistenceFailed,
  subject: 'Classroom',
});

// @owner-scope builder Callers constrain the teacher owner or document their invitation-code capability.
const classrooms = () => db.orm.public.Classroom.select(...CLASSROOM_SELECT);

/**
 * Prisma 8 repository for classes and memberships.
 *
 * Reading a member's display name crosses into the learner module's `ChildProfile` table on
 * purpose and narrowly: one column, through the membership's own foreign key, because a teacher
 * holds no `learner.*` permission and the learner module has no teacher-facing read (#32: display
 * names only). Writes to the profile go through the learner module's use cases instead.
 */
export class PrismaClassroomRepository implements ClassroomRepository {
  constructor(private readonly clock: Clock) {}

  findById(
    id: ClassroomId,
    ownerId: ActorId,
    tenantId: TenantId,
  ): AppResultAsync<Classroom | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => classrooms().where({ id, tenantId, ownerId }).first(),
      failures.infraOnly('findById'),
    ).map((record) => record && toClassroom(record));
  }

  // @owner-scope capability JoinClassroom verifies the parent owns the child before resolving the current active invite-code hash.
  findActiveByInviteCodeHash(
    inviteCodeHash: string,
    tenantId: TenantId,
  ): AppResultAsync<Classroom | null, InfrastructureAppError> {
    const validSince = instantOf(inviteCodeValidSince(this.clock.now()));
    return fromThrowableAsync(
      async () =>
        classrooms()
          .where({ inviteCodeHash, tenantId, status: CLASSROOM_STATUS_RECORD.active })
          .where((row) => row.inviteCodeIssuedAt.gte(validSince))
          .first(),
      failures.infraOnly('findActiveByInviteCodeHash'),
    ).map((record) => record && toClassroom(record));
  }

  listByOwner(
    tenantId: TenantId,
    ownerId: ActorId,
    limit: number,
  ): AppResultAsync<readonly Classroom[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        classrooms()
          .where({ tenantId, ownerId })
          // `id` breaks ties so the order is stable between requests.
          .orderBy([(row) => row.createdAt.desc(), (row) => row.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listByOwner'),
    ).map((records) => records.map(toClassroom));
  }

  create(input: NewClassroom): AppResultAsync<Classroom, InfrastructureAppError> {
    const { tenantId, ownerId, draft, inviteCodeHash } = input;
    return fromThrowableAsync(
      async () =>
        classrooms().create({
          tenantId,
          ownerId,
          inviteCodeHash,
          ...toClassroomCreateData(draft),
        }),
      failures.infraOnly('create'),
    ).map(toClassroom);
  }

  rename(
    id: ClassroomId,
    scope: ClassroomOwnerScope,
    name: string,
  ): AppResultAsync<Classroom, NotFoundAppError | InfrastructureAppError> {
    const { tenantId, ownerId } = scope;
    return fromThrowableAsync(
      async () =>
        classrooms()
          .where({ id, tenantId, ownerId })
          .update({ name, ...touched(this.clock.now()) }),
      failures.infraOnly('rename'),
    )
      .andThen(failures.requireRow(classroomNotFound))
      .map(toClassroom);
  }

  replaceInviteCode(
    id: ClassroomId,
    scope: ClassroomOwnerScope,
    inviteCodeHash: string,
  ): AppResultAsync<Classroom, NotFoundAppError | InfrastructureAppError> {
    const { tenantId, ownerId } = scope;
    const now = this.clock.now();
    return fromThrowableAsync(
      async () =>
        classrooms()
          .where({ id, tenantId, ownerId })
          .update({ inviteCodeHash, inviteCodeIssuedAt: instantOf(now), ...touched(now) }),
      failures.infraOnly('replaceInviteCode'),
    )
      .andThen(failures.requireRow(classroomNotFound))
      .map(toClassroom);
  }

  archive(
    id: ClassroomId,
    tenantId: TenantId,
    ownerId: ActorId,
  ): AppResultAsync<Classroom, NotFoundAppError | InfrastructureAppError> {
    const now = this.clock.now();
    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          const archived = await tx.orm.public.Classroom.select(...CLASSROOM_SELECT)
            .where({ id, tenantId, ownerId })
            .update({ status: CLASSROOM_STATUS_RECORD.archived, ...touched(now) });
          if (archived !== null) {
            // @owner-scope derived Memberships belong to the classroom just archived with id, tenantId and teacher ownerId in this transaction.
            await tx.orm.public.ClassMembership.where({
              classroomId: id,
              tenantId,
            }).deleteAndCount();
          }
          return archived;
        }),
      failures.infraOnly('archive'),
    )
      .andThen(failures.requireRow(classroomNotFound))
      .map(toClassroom);
  }

  // @owner-scope child JoinClassroom and GetChildClassroom first requireOwnChild against the stored profile owner; this tenant and child id identify its membership.
  findMembershipOfChild(
    childProfileId: ChildProfileId,
    tenantId: TenantId,
  ): AppResultAsync<ChildMembership | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.ClassMembership.where({ childProfileId, tenantId })
          .select(...JOINED_AT_SELECT)
          .include('classroom', (classroom) => classroom.select(...CLASSROOM_SELECT))
          .first(),
      failures.infraOnly('findMembershipOfChild'),
    ).map((record) => (record === null ? null : toChildMembership(record)));
  }

  addMember(
    input: NewMembership,
  ): AppResultAsync<Date, NotFoundAppError | ConflictAppError | InfrastructureAppError> {
    const { tenantId, classroomId, childProfileId, inviteCodeHash } = input;
    const validSince = instantOf(inviteCodeValidSince(this.clock.now()));
    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          // ONE `UPDATE … WHERE` (no-op SET) row-locks the class only while it is still active AND
          // its current code is still the one the parent entered and not expired. Postgres
          // re-checks the WHERE on the newest row version, so an archive or a new code running at
          // the same time either commits first (count 0, refused here) or waits for this
          // transaction (and an archive then deletes this membership too). `update()` would read
          // first and write by key, and a plain insert only takes a key-share lock: both slip
          // through.
          // @owner-scope capability JoinClassroom resolved classroomId using the current invite-code hash after requireOwnChild; this locks that active classroom and re-checks the hash.
          const admitting = await tx.orm.public.Classroom.where({
            id: classroomId,
            tenantId,
            inviteCodeHash,
            status: CLASSROOM_STATUS_RECORD.active,
          })
            .where((row) => row.inviteCodeIssuedAt.gte(validSince))
            .updateAndCount({ status: CLASSROOM_STATUS_RECORD.active });
          if (admitting === 0) {
            return null;
          }
          // @owner-scope child JoinClassroom verified requireOwnChild and the invitation capability; the active classroom was locked above in this transaction.
          return tx.orm.public.ClassMembership.select(...JOINED_AT_SELECT).create({
            tenantId,
            classroomId,
            childProfileId,
          });
        }),
      failures.orConflict('addMember', childAlreadyInClassroom),
    ).andThen((record) =>
      record === null ? errAsync(inviteCodeInvalid()) : okAsync(toJoinedAt(record)),
    );
  }

  // @owner-scope child LeaveClassroom and join rollback use only the tenant and child id previously authorized by requireOwnChild.
  removeMemberOfChild(
    childProfileId: ChildProfileId,
    tenantId: TenantId,
  ): AppResultAsync<boolean, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.ClassMembership.where({ childProfileId, tenantId }).deleteAndCount(),
      failures.infraOnly('removeMemberOfChild'),
    ).map((count) => count > 0);
  }

  listMembers(
    classroomId: ClassroomId,
    scope: ClassroomOwnerScope,
    limit: number,
  ): AppResultAsync<readonly ClassMember[], InfrastructureAppError> {
    const { tenantId, ownerId } = scope;
    return fromThrowableAsync(
      async () =>
        db.orm.public.ClassMembership.where({ classroomId, tenantId })
          .where((row) => row.classroom.some({ tenantId, ownerId }))
          .select(...CLASS_MEMBER_SELECT)
          .include('childProfile', (child) => child.select(...CHILD_DISPLAY_NAME_SELECT))
          .orderBy([(row) => row.joinedAt.asc(), (row) => row.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listMembers'),
    ).map((records) => records.map(toClassMember));
  }
}
