import type { AppResultAsync } from '@lib/result';

import { toChildProfileView } from '../learner-view-mappers';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';

import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

/** Reads one child profile of the actor's own tenant. */
export class GetChildProfileById {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(id: string): AppResultAsync<ChildProfileView, LoadChildProfileError> {
    return loadAuthorizedChildProfile(this.deps, id, 'childprofile.read').map(({ childProfile }) =>
      toChildProfileView(childProfile),
    );
  }
}
