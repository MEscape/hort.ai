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
import { giveNextHint } from '../services/hint-ladder';
import { openOwnSession, parseSessionStep } from '../services/session-step';

import type { RequestHintInput } from '../contracts/hint-inputs';
import type { HintStep } from '../contracts/hint-views';
import type { RequestHintDependencies } from '../guidance-dependencies';

export type RequestHintError =
  | AuthorizationError
  | ValidationAppError
  | NotFoundAppError
  | RateLimitedAppError
  | InfrastructureAppError;

/**
 * A parent's child asks for the next hint in one of their help sessions (#10, #11, #30).
 *
 * Order matters: the permission first, so a caller without it learns nothing; then the cheap input
 * checks, so garbage never counts against the child's budget; then the profile's ownership; then
 * the child's budget; then the stored session, which alone decides the level (the hint ladder);
 * then the competencies of the child's curriculum (#28); only then the AI. The AI's answer is
 * validated inside the orchestrator, and a rejected answer is still a success for the child: they
 * get the predefined prompt of the level. Asking is never a failure, just the next rung.
 */
export class RequestHint {
  constructor(private readonly deps: RequestHintDependencies) {}

  execute(input: RequestHintInput): AppResultAsync<HintStep, RequestHintError> {
    const { authorization, audit } = this.deps;

    return authorization.requireInTenant('hint.request').andThen((actor) =>
      parseSessionStep(input)
        .asyncAndThen((step) =>
          openOwnSession(this.deps, { actor, step, policy: GUIDANCE_RATE_LIMITS.hintRequest }).map(
            (session) => ({ session, step }),
          ),
        )
        .andThen(({ session, step }) =>
          ResultAsync.fromSafePromise(giveNextHint(this.deps, session, step.requestId)).map(
            ({ given, isReplay }) => {
              audit.record({
                type: 'guidance.hint_requested',
                tenantId: actor.tenantId,
                actorId: actor.id,
                childProfileId: session.child.id,
                level: given.hint.level,
                outcome: given.hint.kind,
                isReplay,
              });
              return given;
            },
          ),
        ),
    );
  }
}
