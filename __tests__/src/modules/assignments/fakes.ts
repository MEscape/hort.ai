import type { AssignmentsDependencies } from '@modules/assignments/application/assignments-dependencies';
import { CreateAssignment } from '@modules/assignments/application/commands/create-assignment';
import { DeleteAssignment } from '@modules/assignments/application/commands/delete-assignment';
import { UpdateAssignment } from '@modules/assignments/application/commands/update-assignment';
import { GetTeacherAssignmentOverview } from '@modules/assignments/application/queries/get-teacher-assignment-overview';
import { ListChildAssignments } from '@modules/assignments/application/queries/list-child-assignments';
import type { Assignment, ChildAssignment } from '@modules/assignments/domain/models/assignment';
import { toAssignmentId, toClassroomId } from '@modules/assignments/domain/models/ids';
import type { AssignmentEvent } from '@modules/assignments/domain/ports/assignment-audit-log.port';
import type {
  AssignmentOwnerScope,
  AssignmentRepository,
} from '@modules/assignments/domain/ports/assignment.repository';
import type { ClassroomAccess } from '@modules/assignments/domain/ports/classroom-access.port';
import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import type { Actor } from '@modules/auth/domain/models/actor';
import { toActorId } from '@modules/auth/domain/models/ids';
import { PARENT_ROLE, TEACHER_ROLE } from '@modules/auth/domain/models/role';

import { forbiddenError, notFoundError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { parent, recordingAudit, signedInAs } from '../auth/fakes';

export const TEACHER_A = parent({ id: toActorId('teacher-a'), roles: [TEACHER_ROLE] });
export const TEACHER_B = parent({ id: toActorId('teacher-b'), roles: [TEACHER_ROLE] });
export const PARENT = parent({ id: toActorId('parent-1'), roles: [PARENT_ROLE] });
export const OTHER_PARENT = parent({ id: toActorId('parent-2'), roles: [PARENT_ROLE] });

interface FakeClassroom {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly isActive: boolean;
}

interface FakeChild {
  readonly parentId: string;
  readonly classroomId: string | null;
}

/** Stored state shared by every actor, so a "reload" is simply a new set of use cases. */
export function createWorld() {
  const rows = new Map<string, Assignment>();
  const classrooms: FakeClassroom[] = [
    { id: 'class-a', ownerId: TEACHER_A.id, name: '3a', isActive: true },
    { id: 'class-a2', ownerId: TEACHER_A.id, name: '4a', isActive: true },
    { id: 'class-a-old', ownerId: TEACHER_A.id, name: 'old', isActive: false },
    { id: 'class-b', ownerId: TEACHER_B.id, name: '3b', isActive: true },
  ];
  const children = new Map<string, FakeChild>([
    ['child-in-a', { parentId: PARENT.id, classroomId: 'class-a' }],
    ['child-without-class', { parentId: PARENT.id, classroomId: null }],
    ['child-of-other-parent', { parentId: OTHER_PARENT.id, classroomId: 'class-a' }],
  ]);
  const auditEvents: AssignmentEvent[] = [];
  let sequence = 0;
  let clock = 0;

  const owned = (scope: AssignmentOwnerScope) => (row: Assignment) =>
    row.tenantId === scope.tenantId && row.ownerId === scope.ownerId;

  const repository: AssignmentRepository = {
    findById: (id, scope) => {
      const row = rows.get(id);
      return okAsync(row !== undefined && owned(scope)(row) ? row : null);
    },
    findInTenant: (id, tenantId) => {
      const row = rows.get(id);
      return okAsync(row?.tenantId === tenantId ? row : null);
    },
    listByClassroom: (classroomId, scope, limit) =>
      okAsync(
        [...rows.values()]
          .filter((row) => row.classroomId === classroomId && owned(scope)(row))
          .reverse()
          .slice(0, limit),
      ),
    listForChild: (classroomId, tenantId, limit) =>
      okAsync(
        [...rows.values()]
          .filter((row) => row.classroomId === classroomId && row.tenantId === tenantId)
          .reverse()
          .slice(0, limit)
          .map(({ id, title, text, dueDate }): ChildAssignment => ({
            id,
            classroomId,
            title,
            text,
            dueDate,
          })),
      ),
    create: ({ tenantId, ownerId, classroomId, draft }) => {
      sequence += 1;
      clock += 1;
      const row: Assignment = {
        ...draft,
        id: toAssignmentId(`assignment-${sequence}`),
        tenantId,
        ownerId,
        classroomId,
        createdAt: new Date(clock),
        updatedAt: new Date(clock),
      };
      rows.set(row.id, row);
      return okAsync(row);
    },
    update: (id, scope, draft) => {
      const row = rows.get(id);
      if (row === undefined || !owned(scope)(row)) {
        return errAsync(notFoundError('assignments.not_found', 'Assignment not found.'));
      }
      clock += 1;
      const updated = { ...row, ...draft, updatedAt: new Date(clock) };
      rows.set(id, updated);
      return okAsync(updated);
    },
    deleteById: (id, scope) => {
      const row = rows.get(id);
      if (row !== undefined && owned(scope)(row)) {
        rows.delete(id);
      }
      return okAsync(undefined);
    },
  };

  /** Behaves like the classroom module's own queries for the signed-in actor. */
  function classroomAccessFor(actor: Actor): ClassroomAccess {
    const own = (classroom: FakeClassroom) => ({
      id: toClassroomId(classroom.id),
      name: classroom.name,
      grade: 3,
      isActive: classroom.isActive,
    });
    const isTeacher = actor.roles.includes(TEACHER_ROLE);
    return {
      listOwnClassrooms: () =>
        isTeacher
          ? okAsync(classrooms.filter((c) => c.ownerId === actor.id).map(own))
          : errAsync(forbiddenError('auth.permission_denied', 'Denied.')),
      requireOwnClassroom: (id) => {
        const classroom = classrooms.find((c) => c.id === id && c.ownerId === actor.id);
        return classroom === undefined
          ? errAsync(notFoundError('classroom.not_found', 'The classroom was not found.'))
          : okAsync(own(classroom));
      },
      findClassroomOfChild: (childProfileId) => {
        const child = children.get(childProfileId);
        if (child?.parentId !== actor.id) {
          return errAsync(forbiddenError('auth.permission_denied', 'Denied.'));
        }
        return okAsync(child.classroomId === null ? null : toClassroomId(child.classroomId));
      },
    };
  }

  /** What the use cases receive for one signed-in person. */
  function dependenciesFor(actor: Actor): AssignmentsDependencies {
    return {
      authorization: createAuthorizationService({
        currentActor: signedInAs(actor),
        audit: recordingAudit(),
      }),
      assignments: repository,
      classrooms: classroomAccessFor(actor),
      audit: {
        record: (event) => {
          auditEvents.push(event);
        },
      },
    };
  }

  /** The use cases as one signed-in person would reach them. */
  function as(actor: Actor) {
    const deps = dependenciesFor(actor);
    return {
      overview: new GetTeacherAssignmentOverview(deps),
      create: new CreateAssignment(deps),
      update: new UpdateAssignment(deps),
      remove: new DeleteAssignment(deps),
      childTasks: new ListChildAssignments(deps),
    };
  }

  return { rows, auditEvents, repository, dependenciesFor, as };
}

export const DRAFT = {
  title: 'Murmeln verteilen',
  taskText: 'Lisa hat 36 Murmeln und verteilt sie gerecht an 4 Kinder.',
  dueDate: '2026-11-02',
  solutionKey: '9 Murmeln',
} as const;
