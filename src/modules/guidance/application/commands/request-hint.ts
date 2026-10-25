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
import { parseChildProfileId } from '../../domain/models/ids';
import { GUIDANCE_RATE_LIMITS } from '../rate-limits';

import type { RequestHintInput } from '../contracts/hint-inputs';
import type { HintOutcome } from '../contracts/hint-views';
import type { GuidanceDependencies } from '../guidance-dependencies';

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
 * the child's budget; only then the AI. The AI's answer is validated inside the orchestrator, and a
 * rejected answer is still a success for the child: they get the predefined prompt of the level.
 */
export class RequestHint {
  constructor(private readonly deps: GuidanceDependencies) {}

  execute(input: RequestHintInput): AppResultAsync<HintOutcome, RequestHintError> {
    const { authorization, childProfiles, rateLimiter, hints, audit } = this.deps;

    return authorization.requireInTenant('hint.request').andThen((actor) =>
      parseChildProfileId(input.childProfileId)
        .andThen((id) => parseChildTaskText(input.task).map((task) => ({ id, task })))
        .asyncAndThen(({ id, task }) => childProfiles.findOwn(id).map((child) => ({ child, task })))
        .andThen(({ child, task }) =>
          rateLimiter
            .enforce({
              policy: GUIDANCE_RATE_LIMITS.hintRequest,
              subject: { kind: 'identifier', value: `child-profile:${actor.tenantId}:${child.id}` },
            })
            .mapErr(fromRateLimitFailure)
            .map(() => ({ child, task })),
        )
        .andThen(({ child, task }) =>
          ResultAsync.fromSafePromise(
            // TODO(#28): pass the competencies curriculum retrieval finds for the task.
            hints.suggest({ task, level: input.level, competencies: [] }),
          ).map((outcome) => {
            audit.record({
              type: 'guidance.hint_requested',
              tenantId: actor.tenantId,
              actorId: actor.id,
              childProfileId: child.id,
              level: outcome.level,
              outcome: outcome.kind,
            });
            return outcome;
          }),
        ),
    );
  }
}
