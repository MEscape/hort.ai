import type { AppResultAsync } from '@lib/result';

import { toChildProfileView } from '../learner-view-mappers';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';

import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

/**
 * One of the signed-in parent's own child profiles. Another parent's id answers exactly like an
 * unknown one. The classroom module uses it to check a child belongs to the parent (#32).
 */
export class GetChildProfileById {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(id: string): AppResultAsync<ChildProfileView, LoadChildProfileError> {
    return loadAuthorizedChildProfile(this.deps, id, 'learner.read').map(({ childProfile }) =>
      toChildProfileView(childProfile),
    );
  }
}
