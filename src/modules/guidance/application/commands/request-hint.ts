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

import type { ChildTaskText } from '../../domain/models/child-task-text';
import type { HintLevel } from '../../domain/models/hint-level';
import type { CurriculumCompetency } from '../../domain/models/hint-request';
import type { HintSubject } from '../../domain/models/hint-subject';
import type { OwnChildProfile } from '../../domain/ports/child-profile-access.port';
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
 * the child's budget; then the competencies of the child's curriculum (#28); only then the AI. The AI's answer is validated inside the orchestrator, and a
 * rejected answer is still a success for the child: they get the predefined prompt of the level.
 */
export class RequestHint {
  constructor(private readonly deps: GuidanceDependencies) {}

  execute(input: RequestHintInput): AppResultAsync<HintOutcome, RequestHintError> {
    const { authorization, childProfiles, rateLimiter, hints, audit } = this.deps;

    return authorization.requireInTenant('hint.request').andThen((actor) =>
      parseChildProfileId(input.childProfileId)
        .andThen((id) =>
          parseChildTaskText(input.task).andThen((task) =>
            parseHintSubject(input.subject).map((subject) => ({ id, task, subject })),
          ),
        )
        .asyncAndThen(({ id, task, subject }) =>
          childProfiles.findOwn(id).map((child) => ({ child, task, subject })),
        )
        .andThen((checked) =>
          rateLimiter
            .enforce({
              policy: GUIDANCE_RATE_LIMITS.hintRequest,
              subject: {
                kind: 'identifier',
                value: `child-profile:${actor.tenantId}:${checked.child.id}`,
              },
            })
            .mapErr(fromRateLimitFailure)
            .map(() => checked),
        )
        .andThen(({ child, task, subject }) =>
          ResultAsync.fromSafePromise(
            this.groundedIn({ child, task, subject }, input.level).then((competencies) =>
              hints.suggest({ task, level: input.level, competencies }),
            ),
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

  /**
   * The competencies of the child's own state and grade. Without them the hint is less specific,
   * not wrong, so a failed retrieval is logged and the hint goes ahead ungrounded.
   */
  private async groundedIn(
    { child, task, subject }: { child: OwnChildProfile; task: ChildTaskText; subject: HintSubject },
    level: HintLevel,
  ): Promise<readonly CurriculumCompetency[]> {
    const found = await this.deps.competencies.findFor({
      federalState: child.federalState,
      grade: child.grade,
      subject,
      task,
    });
    if (found.isErr()) {
      this.deps.audit.record({
        type: 'guidance.grounding_unavailable',
        level,
        code: found.error.code,
      });
      return [];
    }
    return found.value;
  }
}
