import type { AuthorizationError } from '@modules/auth';
import { getLearnerQueries } from '@modules/learner';

import type { InfrastructureAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import type { ChildAccessPort } from '../../domain/ports/child-access.port';

/**
 * Asks the learner module, which owns the child profile and authorizes the lookup of this one id
 * (the signed-in parent's own profile, or for a channel exactly its bound child). Another parent's
 * or an unknown id is "not owned"; a refusal (a sibling for a bound channel) and every other failure
 * are passed on, never read as "owned".
 */
export function createLearnerChildAccess(
  queries: Pick<ReturnType<typeof getLearnerQueries>, 'getChildProfileById'> = getLearnerQueries(),
): ChildAccessPort {
  return {
    ownsChild: (id) =>
      queries.getChildProfileById
        .execute(id)
        .map(() => true)
        .orElse((error): AppResultAsync<boolean, AuthorizationError | InfrastructureAppError> =>
          error.kind === 'not_found' || error.kind === 'validation'
            ? okAsync(false)
            : errAsync(error),
        ),
  };
}
