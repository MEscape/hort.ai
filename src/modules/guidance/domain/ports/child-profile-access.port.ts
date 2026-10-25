import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ChildProfileId } from '../models/ids';

/** A child profile the signed-in parent is the guardian of. */
export interface OwnChildProfile {
  readonly id: ChildProfileId;
}

export type ChildProfileAccessError =
  AuthorizationError | NotFoundAppError | ValidationAppError | InfrastructureAppError;

/**
 * Finds one of the signed-in parent's own child profiles. Another parent's profile, or another
 * tenant's, is "not found": the learner module decides ownership, never the request.
 */
export interface ChildProfileAccess {
  findOwn(id: ChildProfileId): AppResultAsync<OwnChildProfile, ChildProfileAccessError>;
}
