import type { AuthorizationError } from '@modules/auth';

import type {
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import { ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { currentHintLevel } from '../../domain/hint-ladder/next-hint-level';
import { parseChildTaskText } from '../../domain/models/child-task-text';
import { GUIDANCE_RATE_LIMITS } from '../rate-limits';
import { toRecordedAnswerCheck } from '../services/answer-record';
import { checkForDistress } from '../services/distress-check';
import {
  groundInCurriculum,
  openOwnSession,
  parseSessionStep,
  solutionKeyOf,
} from '../services/session-step';

import type { ChildTaskText } from '../../domain/models/child-task-text';
import type { StepRequestId } from '../../domain/models/ids';
import type { AnswerFeedback } from '../contracts/answer-views';
import type { CheckAnswerInput } from '../contracts/hint-inputs';
import type { CheckAnswerDependencies } from '../guidance-dependencies';
import type { OpenSession } from '../services/session-step';

export type CheckAnswerError =
  | AuthorizationError
  | ValidationAppError
  | NotFoundAppError
  | RateLimitedAppError
  | InfrastructureAppError;

/**
 * The child's own answer to the session's task is checked and worded for them (#14).
 *
 * It needs `hint.request`, not a permission of its own: the same parent asks for the same child,
 * at the same kind of cost (AI calls), and checking an answer is part of the same help with one
 * task. The steps are RequestHint's: permission, cheap input checks (the answer is checked like the
 * task), ownership, the child's own budget (`answerCheck`, since one check costs up to three AI
 * calls), the stored session (its task, and its current rung, which the wording follows),
 * curriculum grounding, then `AnswerCoach`, which never fails and never states the solution. The
 * check is recorded for the session (#78); a recording failure is logged, the child still gets it.
 */
export class CheckAnswer {
  constructor(private readonly deps: CheckAnswerDependencies) {}

  execute(input: CheckAnswerInput): AppResultAsync<AnswerFeedback, CheckAnswerError> {
    const { authorization, audit } = this.deps;

    return authorization.requireInTenant('hint.request').andThen((actor) =>
      parseSessionStep(input)
        .andThen((step) =>
          parseChildTaskText(input.answer, 'answer')
            .andThen((answer) => checkForDistress(audit, answer, 'answer'))
            .map((answer) => ({ step, answer })),
        )
        .asyncAndThen(({ step, answer }) =>
          openOwnSession(this.deps, { actor, step, policy: GUIDANCE_RATE_LIMITS.answerCheck }).map(
            (session) => ({ session, step, answer }),
          ),
        )
        .andThen(({ session, step, answer }) =>
          ResultAsync.fromSafePromise(this.check(session, step.requestId, answer)).map(
            (feedback) => {
              audit.record({
                type: 'guidance.answer_checked',
                tenantId: actor.tenantId,
                actorId: actor.id,
                childProfileId: session.child.id,
                level: currentHintLevel(session.state),
                result: feedback.result,
                assessedBy: feedback.assessedBy,
              });
              return feedback;
            },
          ),
        ),
    );
  }

  private async check(
    session: OpenSession,
    requestId: StepRequestId,
    answer: ChildTaskText,
  ): Promise<AnswerFeedback> {
    const { answers, sessions, audit } = this.deps;
    const level = currentHintLevel(session.state);
    const [competencies, solutionKey] = await Promise.all([
      groundInCurriculum(this.deps, session, level),
      solutionKeyOf(this.deps, session, 'answer_check'),
    ]);
    const feedback = await answers.check({
      task: session.state.task,
      answer,
      solutionKey,
      level,
      competencies,
    });
    const recorded = await sessions.recordAnswerCheck(
      session.ref,
      toRecordedAnswerCheck(requestId, answer, feedback),
    );
    if (recorded.isErr()) {
      audit.record({
        type: 'guidance.step_not_recorded',
        step: 'answer_check',
        code: recorded.error.code,
      });
    }
    return feedback;
  }
}
