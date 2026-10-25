import type { ActorId, TenantId } from '@modules/auth';

import type { AssignmentId, ClassroomId } from '../models/ids';

/**
 * Business facts worth keeping. Ids only: never a title, task text or solution key (security.md).
 * Adding a variant forces the sink's level table to be updated.
 */
export interface AssignmentEvent {
  readonly type: 'assignment.created' | 'assignment.updated' | 'assignment.deleted';
  readonly actorId: ActorId;
  readonly tenantId: TenantId;
  readonly classroomId: ClassroomId;
  readonly assignmentId: AssignmentId;
}

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface AssignmentAuditLog {
  record(event: AssignmentEvent): void;
}
