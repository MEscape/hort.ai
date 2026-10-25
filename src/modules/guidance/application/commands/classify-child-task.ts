import type { AuthorizationError } from '@modules/auth';

import type {
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import { ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { GUIDANCE_RATE_LIMITS } from '../rate-limits';
import { admitOwnChild, groundInCurriculum, parseChildTask } from '../services/child-task';
import { classifyTopic } from '../services/classify-topic';

import type { ClassifyChildTaskInput } from '../contracts/hint-inputs';
import type { ClassifyChildTaskDependencies } from '../guidance-dependencies';
import type { ClassifiedChildTask } from '../services/classify-topic';

export type ClassifyChildTaskError =
  | AuthorizationError
  | ValidationAppError
  | NotFoundAppError
  | RateLimitedAppError
  | InfrastructureAppError;

/**
 * A parent's child starts with a task: Hort.ai sorts it into intent and curriculum topic (#92) and
 * decides whether to help, ask once what the task is, or answer small talk with a friendly redirect.
 *
 * The same steps and order as `RequestHint`: permission, input checks, ownership, the child's hint
 * budget (one classification costs one model call, like a hint), then the candidates of the child's
 * own curriculum, then the classifier. Until the help session (#17) stores whether a clarifying
 * question was already asked, this classifies the starting task only; #17's session start calls
 * the same services after the safety checks of #90. A classifier failure is still a success: the
 * task goes ahead as homework without a competency.
 */
export class ClassifyChildTask {
  constructor(private readonly deps: ClassifyChildTaskDependencies) {}

  execute(
    input: ClassifyChildTaskInput,
  ): AppResultAsync<ClassifiedChildTask, ClassifyChildTaskError> {
    const { authorization, audit } = this.deps;

    return authorization.requireInTenant('hint.request').andThen((actor) =>
      parseChildTask(input)
        .asyncAndThen((parsed) =>
          admitOwnChild(this.deps, { actor, parsed, policy: GUIDANCE_RATE_LIMITS.hintRequest }),
        )
        .andThen((admitted) =>
          ResultAsync.fromSafePromise(
            // The session opens on the first rung of the ladder; the level only labels a grounding failure.
            groundInCurriculum(this.deps, admitted, 'understand_task').then((candidates) =>
              classifyTopic(this.deps, {
                task: admitted.task,
                subject: admitted.subject,
                candidates,
                clarificationAlreadyAsked: false,
              }),
            ),
          ).map((classified) => {
            audit.record({
              type: 'guidance.child_task_classified',
              tenantId: actor.tenantId,
              actorId: actor.id,
              childProfileId: admitted.child.id,
              action: classified.decision.action,
              classifiedBy: classified.classifiedBy,
            });
            return classified;
          }),
        ),
    );
  }
}
