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

import type { RequestHintInput } from '../contracts/hint-inputs';
import type { HintOutcome } from '../contracts/hint-views';
import type { RequestHintDependencies } from '../guidance-dependencies';

export type RequestHintError =
  | AuthorizationError
  | ValidationAppError
  | NotFoundAppError
  | RateLimitedAppError
  | InfrastructureAppError;

/**
 * A parent asks the AI companion for one hint for one of their own children (#10, #11).
 *
 * Order matters: the permission first, so a caller without it learns nothing; then the cheap input
 * checks, so garbage never counts against the child's budget; then the profile's ownership; then
 * the child's budget; then the competencies of the child's curriculum (#28); only then the AI. The AI's answer is validated inside the orchestrator, and a
 * rejected answer is still a success for the child: they get the predefined prompt of the level.
 */
export class RequestHint {
  constructor(private readonly deps: RequestHintDependencies) {}

  execute(input: RequestHintInput): AppResultAsync<HintOutcome, RequestHintError> {
    const { authorization, hints, audit } = this.deps;

    return authorization.requireInTenant('hint.request').andThen((actor) =>
      parseChildTask(input)
        .asyncAndThen((parsed) =>
          admitOwnChild(this.deps, { actor, parsed, policy: GUIDANCE_RATE_LIMITS.hintRequest }),
        )
        .andThen((admitted) =>
          ResultAsync.fromSafePromise(
            groundInCurriculum(this.deps, admitted, input.level).then((competencies) =>
              hints.suggest({ task: admitted.task, level: input.level, competencies }),
            ),
          ).map((outcome) => {
            audit.record({
              type: 'guidance.hint_requested',
              tenantId: actor.tenantId,
              actorId: actor.id,
              childProfileId: admitted.child.id,
              level: outcome.level,
              outcome: outcome.kind,
            });
            return outcome;
          }),
        ),
    );
  }
}
