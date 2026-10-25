import type { AuthorizationError } from '@modules/auth';

import type {
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import { ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/guidance-errors';
import { parseChildTaskText } from '../../domain/models/child-task-text';
import { parseHintSubject } from '../../domain/models/hint-subject';
import { parseChildProfileId } from '../../domain/models/ids';
import { GUIDANCE_RATE_LIMITS } from '../rate-limits';
import { classifyTopic } from '../services/classify-topic';

import type { StartHelpSessionInput } from '../contracts/help-session-inputs';
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
 * It takes the same input as `StartHelpSession`.
 *
 * Order: permission, input checks, ownership, the child's hint budget (one classification costs
 * one model call, like a hint), the candidates of the child's own curriculum, then the classifier.
 * Interim: it stores nothing and classifies the starting task only, because whether a clarifying
 * question was already asked is session state the client must not send. Moving it into the session
 * start, after the distress check (#90), is the next step of #92. A classifier failure is still a
 * success: the task goes ahead as homework without a competency.
 */
export class ClassifyChildTask {
  constructor(private readonly deps: ClassifyChildTaskDependencies) {}

  execute(
    input: StartHelpSessionInput,
  ): AppResultAsync<ClassifiedChildTask, ClassifyChildTaskError> {
    const { authorization, childProfiles, competencies, rateLimiter, audit } = this.deps;

    return authorization.requireInTenant('hint.request').andThen((actor) =>
      parseChildProfileId(input.childProfileId)
        .andThen((id) =>
          parseChildTaskText(input.task).andThen((task) =>
            parseHintSubject(input.subject).map((subject) => ({ id, task, subject })),
          ),
        )
        .asyncAndThen(({ id, task, subject }) =>
          childProfiles.findOwn(id).andThen((child) =>
            rateLimiter
              .enforce({
                policy: GUIDANCE_RATE_LIMITS.hintRequest,
                subject: {
                  kind: 'identifier',
                  value: `child-profile:${actor.tenantId}:${child.id}`,
                },
              })
              .mapErr(fromRateLimitFailure)
              .andThen(() =>
                ResultAsync.fromSafePromise(
                  competencies
                    .findFor({
                      federalState: child.federalState,
                      grade: child.grade,
                      subject,
                      task,
                    })
                    .match(
                      (found) => found,
                      (failure) => {
                        // The session opens on the first rung; without candidates only the intent is classified.
                        audit.record({
                          type: 'guidance.grounding_unavailable',
                          level: 'understand_task',
                          code: failure.code,
                        });
                        return [];
                      },
                    )
                    .then((candidates) =>
                      classifyTopic(this.deps, {
                        task,
                        subject,
                        candidates,
                        clarificationAlreadyAsked: false,
                      }),
                    ),
                ),
              )
              .map((classified) => {
                audit.record({
                  type: 'guidance.child_task_classified',
                  tenantId: actor.tenantId,
                  actorId: actor.id,
                  childProfileId: child.id,
                  action: classified.decision.action,
                  classifiedBy: classified.classifiedBy,
                });
                return classified;
              }),
          ),
        ),
    );
  }
}
