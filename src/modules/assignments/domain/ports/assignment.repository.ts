import type { ActorId, TenantId } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type {
  Assignment,
  AssignmentDraft,
  AssignmentForHelp,
  ChildAssignment,
} from '../models/assignment';
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
  /**
   * Loads within the tenant only, for `loadAuthorizedAssignment`, which then compares the STORED
   * owner with the actor (`requireOnResource`): another teacher's assignment is refused.
   */
  findInTenant(
    id: AssignmentId,
    tenantId: TenantId,
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
  /**
   * A class's assignments as its children see them, newest first. Not pinned to the teacher: the
   * caller has already established that the signed-in parent's child is a member of this class.
   * The solution key is never read.
   */
  listForChild(
    classroomId: ClassroomId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly ChildAssignment[], InfrastructureAppError>;
  /**
   * One assignment of a class, with its solution key, for the help on it (#33). Not pinned to the
   * teacher: the caller has already established that the signed-in parent's child is a member of
   * this class. `null` when the class has no such assignment.
   */
  findForHelp(
    id: AssignmentId,
    classroomId: ClassroomId,
    tenantId: TenantId,
  ): AppResultAsync<AssignmentForHelp | null, InfrastructureAppError>;
}
