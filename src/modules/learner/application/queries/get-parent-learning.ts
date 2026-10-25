import type { AppResultAsync } from '@lib/result';

import { parentPeriod } from '../../domain/models/parent-period';
import { parentLearningScope } from '../child-profile-scope';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';
import { aggregateParentLearning } from '../services/aggregate-parent-learning';

import type { ParentLearningView, ParentRange } from '../contracts/parent-learning-views';
import type { ParentLearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

export type GetParentLearningError = LoadChildProfileError;

/** Parent authorization is injected in composition and checked before any profile or learning read. */
export class GetParentLearning {
  constructor(private readonly deps: ParentLearnerDependencies) {}

  execute(input: {
    readonly profileId: string;
    readonly range: ParentRange;
  }): AppResultAsync<ParentLearningView, GetParentLearningError> {
    return loadAuthorizedChildProfile(this.deps, input.profileId, 'learner.read').andThen(
      ({ childProfile }) => {
        const period = parentPeriod(input.range, this.deps.clock.now());
        return this.deps.learning
          .list(parentLearningScope(childProfile), period)
          .map((records) => ({
            records,
            period,
            metrics: aggregateParentLearning(records, period),
            insightsEnabled: childProfile.controls.learningInsights,
          }));
      },
    );
  }
}
