import type { AppResultAsync } from '@lib/result';

import { toChildProfileView } from '../learner-view-mappers';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';

import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

export type GetChildProfileError = LoadChildProfileError;

/**
 * One of the signed-in parent's own profiles, finished or not. Another parent's id answers like an
 * unknown one (`learner.not_found`). Other modules use it to check ownership before acting for a
 * child (the AI companion, #10).
 */
export class GetChildProfile {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(profileId: string): AppResultAsync<ChildProfileView, GetChildProfileError> {
    return loadAuthorizedChildProfile(this.deps, profileId, 'learner.read').map(
      ({ childProfile }) => toChildProfileView(childProfile),
    );
  }
}
