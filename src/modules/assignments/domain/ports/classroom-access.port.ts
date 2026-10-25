import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ChildProfileId, ClassroomId } from '../models/ids';

export type ClassroomAccessError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/** A class of the signed-in teacher, as far as posting assignments needs it. */
export interface OwnClassroom {
  readonly id: ClassroomId;
  readonly name: string;
  readonly grade: number;
  /** An archived class is read-only and takes no new assignments. */
  readonly isActive: boolean;
}

/**
 * The classroom module, as this module needs it. Every call runs the classroom's own use cases for
 * the signed-in person, so ownership is decided there against the stored records: another
 * teacher's class is "not found", another parent's child is refused.
 */
export interface ClassroomAccess {
  /** The signed-in teacher's own classes, newest first, bounded by the classroom module. */
  listOwnClassrooms(): AppResultAsync<readonly OwnClassroom[], ClassroomAccessError>;

  /** Succeeds only for a class the signed-in teacher owns. */
  requireOwnClassroom(classroomId: ClassroomId): AppResultAsync<OwnClassroom, ClassroomAccessError>;

  /** The class of the signed-in parent's own child, or `null` when the child is in no class. */
  findClassroomOfChild(
    childProfileId: ChildProfileId,
  ): AppResultAsync<ClassroomId | null, ClassroomAccessError>;
}
