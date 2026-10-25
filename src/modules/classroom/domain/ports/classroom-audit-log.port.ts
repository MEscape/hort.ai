import type { ActorId, TenantId } from '@modules/auth';

import type { ChildProfileId, ClassroomId } from '../models/ids';

interface ClassroomEventBase {
  readonly actorId: ActorId;
  readonly tenantId: TenantId;
}

/**
 * Business facts worth keeping. Ids and codes only: never a class name, a child's name or an
 * invite code (security.md, #32). Adding a variant forces the sink's level table to be updated.
 */
export type ClassroomEvent =
  | (ClassroomEventBase & {
      readonly type:
        | 'classroom.created'
        | 'classroom.renamed'
        | 'classroom.archived'
        | 'classroom.invite_code_regenerated';
      readonly classroomId: ClassroomId;
    })
  | (ClassroomEventBase & {
      readonly type: 'classroom.child_joined';
      readonly classroomId: ClassroomId;
      readonly childProfileId: ChildProfileId;
    })
  | (ClassroomEventBase & {
      readonly type: 'classroom.child_left';
      readonly childProfileId: ChildProfileId;
    })
  | (ClassroomEventBase & {
      /** A join that was turned away: a wrong code (possible guessing) or a child already in a class. */
      readonly type: 'classroom.join_refused';
      readonly reason: 'invite_code_invalid' | 'child_already_in_classroom';
    });

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface ClassroomAuditLog {
  record(event: ClassroomEvent): void;
}
