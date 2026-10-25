import type { ActorId, TenantId } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { Assignment, AssignmentDraft } from '../models/assignment';
import type { AssignmentId, ClassroomId } from '../models/ids';

/** Scope always comes from the authorized actor, never from request fields. */
export interface AssignmentOwnerScope {
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
}

export interface NewAssignment extends AssignmentOwnerScope {
  readonly classroomId: ClassroomId;
  readonly draft: AssignmentDraft;
}

/** Teacher-only storage. A posting use case must also authorize the referenced class. */
export interface AssignmentRepository {
  findById(
    id: AssignmentId,
    scope: AssignmentOwnerScope,
  ): AppResultAsync<Assignment | null, InfrastructureAppError>;
  listByClassroom(
    classroomId: ClassroomId,
    scope: AssignmentOwnerScope,
    limit: number,
  ): AppResultAsync<readonly Assignment[], InfrastructureAppError>;
  create(input: NewAssignment): AppResultAsync<Assignment, InfrastructureAppError>;
  update(
    id: AssignmentId,
    scope: AssignmentOwnerScope,
    draft: AssignmentDraft,
  ): AppResultAsync<Assignment, NotFoundAppError | InfrastructureAppError>;
  deleteById(
    id: AssignmentId,
    scope: AssignmentOwnerScope,
  ): AppResultAsync<void, InfrastructureAppError>;
}
