import type { Actor, AuthorizationError } from '@modules/auth';
import { FALLBACK_AREA_ID } from '@modules/world';

import type {
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import { validationError } from '@lib/errors';
import { errAsync, okAsync, ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { detectsChildDistress } from '../../domain/child-safety/detect-child-distress';
import { GUIDANCE_ERROR_CODES } from '../../domain/errors/guidance-errors';
import { isSameTask } from '../../domain/models/help-session';
import { parseHintSubject } from '../../domain/models/hint-subject';
import { parseChildProfileId } from '../../domain/models/ids';
import { parseSessionIsland } from '../../domain/models/session-island';
import { HOMEWORK_AREA_IDS_MAX } from '../guidance-limits';
import { GUIDANCE_RATE_LIMITS } from '../rate-limits';
import { spendChildBudget } from '../services/child-budget';
import { classifySessionTask } from '../services/classify-session-task';
import { parseRequestedTask, resolveSessionSource } from '../services/help-session-source';
import { toHelpSessionView } from '../services/help-session-view';
import { requireDailyBudget, requireWindowOpen } from '../services/learning-time';
import { ownChildScope } from '../services/own-child-session';

import type { HelpSessionSource } from '../../domain/models/help-session';
import type { ChildProfileId } from '../../domain/models/ids';
import type { SessionIsland } from '../../domain/models/session-island';
import type { OwnChildProfile } from '../../domain/ports/child-profile-access.port';
import type { HelpSessionOwner } from '../../domain/ports/help-session.repository';
import type { StartHelpSessionInput } from '../contracts/help-session-inputs';
import type { StartHelpSessionView } from '../contracts/help-session-views';
import type { HelpSessionDependencies } from '../help-session-dependencies';
import type { RequestedTask } from '../services/help-session-source';

/** A closed learning window or a reached daily limit (#88) is `rate_limited`, with the time it reopens. */
export type StartHelpSessionError =
  | AuthorizationError
  | ValidationAppError
  | NotFoundAppError
  | RateLimitedAppError
  | InfrastructureAppError;

/**
 * A parent's child starts a help session on their own task (#17), or on a teacher's assignment of
 * the class they are in (#33). The child has at most one open session: the same task again
 * continues it (so a retried start creates nothing), a different task ends the open one as
 * `abandoned` and starts anew, in one transaction.
 *
 * Ownership comes first: the learner module confirms the child is the parent's own before the
 * assignments module is asked whether the child's class has the assignment. Another class's
 * assignment is `guidance.assignment_not_found`, exactly like a missing one, and nothing is stored.
 *
 * `hint.request` is the guidance capability of the child's guardian, as for hints themselves. Every
 * new task stores a session and is classified once by intent and curriculum topic (#92), so it
 * spends the child's `sessionStart` budget once the child is known to be the parent's own. The
 * classification decides the session's opening (clarify, redirect or none); it never fails the start.
 *
 * Before any of that, once the child is known to be the parent's own: the distress check (#90,
 * `guidance.child_distress`, it wins over everything else), then the parent's learning window
 * (#88, `guidance.learning_window_closed`). A new task also needs the day's budget
 * (`guidance.daily_limit_reached`); the open one may be finished. None of them stores, spends or
 * asks the AI.
 */
export class StartHelpSession {
  constructor(private readonly deps: HelpSessionDependencies) {}

  execute(
    input: StartHelpSessionInput,
  ): AppResultAsync<StartHelpSessionView, StartHelpSessionError> {
    const { authorization, rateLimiter } = this.deps;
    const policy = GUIDANCE_RATE_LIMITS.sessionStart;

    return authorization.requireInTenant('hint.request').andThen((actor) =>
      parseChildProfileId(input.childProfileId)
        .andThen((id) =>
          parseRequestedTask(input).andThen((requested) =>
            parseHintSubject(input.subject).andThen((subject) =>
              parseSessionIsland(input.areaId, input.placeId).map((island) => ({
                id,
                requested,
                subject,
                island,
              })),
            ),
          ),
        )
        .asyncAndThen(({ id, requested, subject, island }) =>
          ownChildScope(this.deps, actor, id).andThen(({ owner, childProfileId, child }) =>
            this.refuseDistress(actor, childProfileId, requested)
              .andThen(() => requireWindowOpen(this.deps, child))
              .andThen(() => spendChildBudget(rateLimiter, { actor, childProfileId, policy }))
              .andThen(() =>
                resolveSessionSource(this.deps, { childProfileId, requested, subject }),
              )
              .andThen((source) =>
                this.startOrContinue(actor, { owner, childProfileId, child, source, island }),
              ),
          ),
        ),
    );
  }

  /**
   * The child's own words that look like distress (#90) get the trusted-adult notice instead of
   * help: no AI call, no session stored, ids only in the log. A teacher's text is not the child's.
   */
  private refuseDistress(
    actor: Actor,
    childProfileId: ChildProfileId,
    requested: RequestedTask,
  ): AppResultAsync<void, ValidationAppError> {
    if (requested.kind !== 'own' || !detectsChildDistress(requested.task)) {
      return okAsync(undefined);
    }
    this.deps.audit.record({
      type: 'guidance.child_distress_detected',
      tenantId: actor.tenantId,
      actorId: actor.id,
      childProfileId,
      sessionId: null,
      step: 'start',
    });
    return errAsync(
      validationError(GUIDANCE_ERROR_CODES.childDistress, 'The child may be in danger.', {}),
    );
  }

  /**
   * The picked island, only when the child may start there: the starting island, or one an earlier
   * homework session of the child cleared. An island still in the mist is ignored, so only a
   * classified homework task ever clears it, never a link.
   */
  private clearedIsland(
    owner: HelpSessionOwner,
    childProfileId: ChildProfileId,
    island: SessionIsland | null,
  ): AppResultAsync<SessionIsland | null, InfrastructureAppError> {
    if (island === null || island.areaId === FALLBACK_AREA_ID) {
      return okAsync(island);
    }
    return this.deps.sessions
      .homeworkAreaIds(owner, childProfileId, HOMEWORK_AREA_IDS_MAX)
      .map((cleared) => (cleared.includes(island.areaId) ? island : null));
  }

  /** The open session when it is on the same task; otherwise a new one that replaces it. */
  private startOrContinue(
    actor: Actor,
    {
      owner,
      childProfileId,
      child,
      source,
      island,
    }: {
      readonly owner: HelpSessionOwner;
      readonly childProfileId: ChildProfileId;
      readonly child: OwnChildProfile;
      readonly source: HelpSessionSource;
      readonly island: SessionIsland | null;
    },
  ): AppResultAsync<StartHelpSessionView, RateLimitedAppError | InfrastructureAppError> {
    const { sessions, audit } = this.deps;

    return sessions.findOpen(owner, childProfileId).andThen((open) => {
      if (open !== null && isSameTask(open, source)) {
        return okAsync<StartHelpSessionView>({
          outcome: 'continued',
          session: toHelpSessionView(open),
        });
      }
      const replaces = open?.id ?? null;
      // Only a new task asks for the day's budget; the open one may be finished (#88).
      return requireDailyBudget(this.deps, sessions, owner, child)
        .andThen(() => this.clearedIsland(owner, childProfileId, island))
        .andThen((picked) =>
          ResultAsync.fromSafePromise(
            classifySessionTask(this.deps, {
              child,
              task: source.task,
              subject: source.subject,
              replaces: open,
              island: picked,
            }),
          ),
        )
        .andThen((topic) => sessions.start(owner, { childProfileId, ...source, replaces, topic }))
        .map(({ session, created }): StartHelpSessionView => {
          if (created) {
            audit.record({
              type: 'guidance.session_started',
              tenantId: actor.tenantId,
              actorId: actor.id,
              childProfileId,
              sessionId: session.id,
              assignmentId: source.assignmentId,
              subject: source.subject,
              replaced: replaces,
              opening: session.topic.opening?.kind ?? null,
            });
          }
          return {
            outcome: created ? 'started' : 'continued',
            session: toHelpSessionView(session),
          };
        });
    });
  }
}
