import type { ActorId, TenantId } from '@modules/auth';

import type { AssignmentId, ClassroomId } from './ids';

/** Internal teacher record. Never serialize this record into a child-facing response. */
export interface Assignment extends AssignmentDraft {
  readonly id: AssignmentId;
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
  readonly classroomId: ClassroomId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Validated by the posting use case before reaching the repository. Dates are ISO calendar dates. */
export interface AssignmentDraft {
  readonly title: string;
  readonly text: string;
  readonly dueDate: string | null;
  readonly solutionKey: string | null;
}

/** Allowlist projection: neither solutionKey nor account identifiers can escape by spreading. */
export function toChildAssignment(assignment: Assignment) {
  return {
    id: assignment.id,
    classroomId: assignment.classroomId,
    title: assignment.title,
    text: assignment.text,
    dueDate: assignment.dueDate,
  };
}
