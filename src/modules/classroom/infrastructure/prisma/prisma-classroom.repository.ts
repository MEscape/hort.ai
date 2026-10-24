import type { ActorId, TenantId } from '@modules/auth';

import type { Clock } from '@lib/clock';
import { db, createPersistenceFailures } from '@lib/db';
import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  CLASSROOM_ERROR_CODES,
  childAlreadyInClassroom,
  classroomArchived,
  classroomNotFound,
} from '../../domain/errors/classroom-errors';

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
  NewClassroom,
  NewMembership,
} from '../../domain/ports/classroom.repository';

const failures = createPersistenceFailures({
  module: 'classroom.persistence',
  code: CLASSROOM_ERROR_CODES.persistenceFailed,
  subject: 'Classroom',
});

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
    tenantId: TenantId,
  ): AppResultAsync<Classroom | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => classrooms().where({ id, tenantId }).first(),
      failures.infraOnly('findById'),
    ).map((record) => record && toClassroom(record));
  }

  findActiveByInviteCodeHash(
    inviteCodeHash: string,
    tenantId: TenantId,
  ): AppResultAsync<Classroom | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        classrooms()
          .where({ inviteCodeHash, tenantId, status: CLASSROOM_STATUS_RECORD.active })
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
    tenantId: TenantId,
    name: string,
  ): AppResultAsync<Classroom, NotFoundAppError | InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        classrooms()
          .where({ id, tenantId })
          .update({ name, ...touched(this.clock.now()) }),
      failures.infraOnly('rename'),
    )
      .andThen(failures.requireRow(classroomNotFound))
      .map(toClassroom);
  }

  replaceInviteCode(
    id: ClassroomId,
    tenantId: TenantId,
    inviteCodeHash: string,
  ): AppResultAsync<Classroom, NotFoundAppError | InfrastructureAppError> {
    const now = this.clock.now();
    return fromThrowableAsync(
      async () =>
        classrooms()
          .where({ id, tenantId })
          .update({ inviteCodeHash, inviteCodeIssuedAt: instantOf(now), ...touched(now) }),
      failures.infraOnly('replaceInviteCode'),
    )
      .andThen(failures.requireRow(classroomNotFound))
      .map(toClassroom);
  }

  archive(
    id: ClassroomId,
    tenantId: TenantId,
  ): AppResultAsync<Classroom, NotFoundAppError | InfrastructureAppError> {
    const now = this.clock.now();
    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          const archived = await tx.orm.public.Classroom.select(...CLASSROOM_SELECT)
            .where({ id, tenantId })
            .update({ status: CLASSROOM_STATUS_RECORD.archived, ...touched(now) });
          if (archived !== null) {
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

  addMember(input: NewMembership): AppResultAsync<Date, ConflictAppError | InfrastructureAppError> {
    const { tenantId, classroomId, childProfileId } = input;
    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          // Row-locks the class while it is still active: an archive running at the same time
          // either finishes first (no row, refused here) or waits and then deletes this
          // membership too. A plain insert only takes a key-share lock and would slip through.
          const active = await tx.orm.public.Classroom.select('id')
            .where({ id: classroomId, tenantId, status: CLASSROOM_STATUS_RECORD.active })
            .update({ status: CLASSROOM_STATUS_RECORD.active });
          if (active === null) {
            return null;
          }
          return tx.orm.public.ClassMembership.select(...JOINED_AT_SELECT).create({
            tenantId,
            classroomId,
            childProfileId,
          });
        }),
      failures.orConflict('addMember', childAlreadyInClassroom),
    ).andThen((record) =>
      record === null ? errAsync(classroomArchived()) : okAsync(toJoinedAt(record)),
    );
  }

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
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly ClassMember[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.ClassMembership.where({ classroomId, tenantId })
          .select(...CLASS_MEMBER_SELECT)
          .include('childProfile', (child) => child.select(...CHILD_DISPLAY_NAME_SELECT))
          .orderBy([(row) => row.joinedAt.asc(), (row) => row.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listMembers'),
    ).map((records) => records.map(toClassMember));
  }
}
