import type { AppResultAsync } from '@lib/result';

import { toChildProfileView } from '../learner-view-mappers';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';

import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

export type GetChildProfileByIdError = LoadChildProfileError;

/**
 * One of the signed-in parent's own child profiles, for the modules that act for that child (voice
 * consent). Another parent's id answers exactly like an unknown one.
 */
export class GetChildProfileById {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(id: string): AppResultAsync<ChildProfileView, GetChildProfileByIdError> {
    return loadAuthorizedChildProfile(this.deps, id, 'learner.read').map(({ childProfile }) =>
      toChildProfileView(childProfile),
    );
  }
}
