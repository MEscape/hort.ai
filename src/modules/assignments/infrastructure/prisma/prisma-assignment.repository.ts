import type { Clock } from '@lib/clock';
import { db, createPersistenceFailures, dateToInstant } from '@lib/db';
import { notFoundError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';

import {
  ASSIGNMENT_SELECT,
  toAssignment,
  toAssignmentCreateData,
} from './assignment-record-mapper';

import type { AssignmentDraft } from '../../domain/models/assignment';
import type { AssignmentId, ClassroomId } from '../../domain/models/ids';
import type {
  AssignmentOwnerScope,
  AssignmentRepository,
  NewAssignment,
} from '../../domain/ports/assignment.repository';

const failures = createPersistenceFailures({
  module: 'assignments.persistence',
  code: 'assignments.persistence_failed',
  subject: 'Assignment',
});

/** @owner-scope builder Every caller pins the query to the authorized teacher. */
const assignments = () => db.orm.public.Assignment.select(...ASSIGNMENT_SELECT);

/** Internal teacher repository. No child-facing action serializes its records. */
export class PrismaAssignmentRepository implements AssignmentRepository {
  constructor(private readonly clock: Clock) {}

  findById(id: AssignmentId, scope: AssignmentOwnerScope) {
    return fromThrowableAsync(
      async () =>
        assignments().where({ id, tenantId: scope.tenantId, ownerId: scope.ownerId }).first(),
      failures.infraOnly('findById'),
    ).map((record) => record && toAssignment(record));
  }

  listByClassroom(classroomId: ClassroomId, scope: AssignmentOwnerScope, limit: number) {
    return fromThrowableAsync(
      async () =>
        assignments()
          .where({ classroomId, tenantId: scope.tenantId, ownerId: scope.ownerId })
          .orderBy([(row) => row.createdAt.desc(), (row) => row.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listByClassroom'),
    ).map((records) => records.map(toAssignment));
  }

  create(input: NewAssignment) {
    return fromThrowableAsync(
      async () =>
        assignments().create({
          tenantId: input.tenantId,
          ownerId: input.ownerId,
          classroomId: input.classroomId,
          ...toAssignmentCreateData(input.draft),
        }),
      failures.infraOnly('create'),
    ).map(toAssignment);
  }

  update(id: AssignmentId, scope: AssignmentOwnerScope, draft: AssignmentDraft) {
    return fromThrowableAsync(
      async () =>
        assignments()
          .where({ id, tenantId: scope.tenantId, ownerId: scope.ownerId })
          .update({
            ...toAssignmentCreateData(draft),
            updatedAt: dateToInstant(this.clock.now()),
          }),
      failures.infraOnly('update'),
    )
      .andThen(
        failures.requireRow(() => notFoundError('assignments.not_found', 'Assignment not found.')),
      )
      .map(toAssignment);
  }

  deleteById(id: AssignmentId, scope: AssignmentOwnerScope) {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Assignment.where({
          id,
          tenantId: scope.tenantId,
          ownerId: scope.ownerId,
        }).deleteAndCount(),
      failures.infraOnly('deleteById'),
    ).map(() => undefined);
  }
}
