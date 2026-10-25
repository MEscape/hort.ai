import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ChildProfileId } from '../models/ids';

/**
 * Whether the signed-in parent owns this child. The child profile belongs to the learner module;
 * this module only asks, and a foreign or unknown id both read as `false`.
 */
export interface ChildAccessPort {
  ownsChild(
    id: ChildProfileId,
  ): AppResultAsync<boolean, AuthorizationError | InfrastructureAppError>;
}
