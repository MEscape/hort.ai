import type { AuthorizationError } from '@modules/auth';

import type {
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import { ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseChildTaskText } from '../../domain/models/child-task-text';
import { GUIDANCE_RATE_LIMITS } from '../rate-limits';
import { admitOwnChild, groundInCurriculum, parseChildTask } from '../services/child-task';

import type { AnswerFeedback } from '../contracts/answer-views';
import type { CheckAnswerInput } from '../contracts/hint-inputs';
import type { CheckAnswerDependencies } from '../guidance-dependencies';

export type CheckAnswerError =
  | AuthorizationError
  | ValidationAppError
  | NotFoundAppError
  | RateLimitedAppError
  | InfrastructureAppError;

/**
 * The child's own answer to a task is checked and worded for them (#14).
 *
 * It needs `hint.request`, not a permission of its own: the same parent asks for the same child,
 * at the same kind of cost (AI calls), and checking an answer is part of the same help with one
 * task. The steps are RequestHint's: permission, cheap input checks (the answer is checked like the
 * task), ownership, the child's own budget (`answerCheck`, since one check costs up to three AI
 * calls), curriculum grounding, then `AnswerCoach`, which never fails and never states the
 * solution. Storing the result and the child's reply to the comprehension question needs session
 * state (#17, #35) and is not done here.
 */
export class CheckAnswer {
  constructor(private readonly deps: CheckAnswerDependencies) {}

  execute(input: CheckAnswerInput): AppResultAsync<AnswerFeedback, CheckAnswerError> {
    const { authorization, answers, audit } = this.deps;

    return authorization.requireInTenant('hint.request').andThen((actor) =>
      parseChildTask(input)
        .andThen((parsed) =>
          parseChildTaskText(input.answer, 'answer').map((answer) => ({ parsed, answer })),
        )
        .asyncAndThen(({ parsed, answer }) =>
          admitOwnChild(this.deps, { actor, parsed, policy: GUIDANCE_RATE_LIMITS.answerCheck }).map(
            (admitted) => ({ admitted, answer }),
          ),
        )
        .andThen(({ admitted, answer }) =>
          ResultAsync.fromSafePromise(
            groundInCurriculum(this.deps, admitted, input.level).then((competencies) =>
              answers.check({
                task: admitted.task,
                answer,
                // TODO(#33): a teacher's assignment brings its solution key; a child's own task has none.
                solutionKey: null,
                level: input.level,
                competencies,
              }),
            ),
          ).map((feedback) => {
            audit.record({
              type: 'guidance.answer_checked',
              tenantId: actor.tenantId,
              actorId: actor.id,
              childProfileId: admitted.child.id,
              level: input.level,
              result: feedback.result,
              assessedBy: feedback.assessedBy,
            });
            return feedback;
          }),
        ),
    );
  }
}
