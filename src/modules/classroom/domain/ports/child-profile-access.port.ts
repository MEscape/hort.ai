import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ClassroomFederalState } from '../models/classroom';
import type { ChildProfileId } from '../models/ids';

export type ChildProfileAccessError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/** What a child takes over from the class it joins (B S, #8). */
export interface ClassroomSettings {
  readonly federalState: ClassroomFederalState;
  readonly grade: number;
}

/**
 * The learner module, as this module needs it. Both calls run the learner's own use cases for the
 * signed-in parent, so ownership of the child profile is decided there (`requireOnResource` on the
 * stored profile): another parent's child, or a profile that does not exist, is "not found".
 */
export interface ChildProfileAccess {
  /** Succeeds only for a child profile of the signed-in parent. */
  requireOwnChild(childProfileId: ChildProfileId): AppResultAsync<void, ChildProfileAccessError>;

  /** Copies the class's federal state and grade into the child's profile. */
  adoptClassroomSettings(
    childProfileId: ChildProfileId,
    settings: ClassroomSettings,
  ): AppResultAsync<void, ChildProfileAccessError>;
}
