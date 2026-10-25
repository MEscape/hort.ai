import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { childProfileNotFound } from '../../domain/errors/learner-errors';
import { parseParentTaskId } from '../../domain/models/ids';
import { parentLearningScope } from '../child-profile-scope';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';

import type { ParentTask } from '../contracts/parent-learning-views';
import type { ParentLearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

export type GetParentTaskError = LoadChildProfileError;

/** Exact, owner-scoped lookup. A foreign session and an unknown session have the same result. */
export class GetParentTask {
  constructor(private readonly deps: ParentLearnerDependencies) {}

  execute(input: {
    readonly profileId: string;
    readonly taskId: string;
  }): AppResultAsync<ParentTask, GetParentTaskError> {
    return loadAuthorizedChildProfile(this.deps, input.profileId, 'learner.read').andThen(
      ({ childProfile }) =>
        parseParentTaskId(input.taskId).asyncAndThen((taskId) =>
          this.deps.learning
            .findTask(parentLearningScope(childProfile), taskId)
            .andThen((task) => (task === null ? errAsync(childProfileNotFound()) : okAsync(task))),
        ),
    );
  }
}
