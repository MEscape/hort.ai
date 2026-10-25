import type { Actor, AuthorizationError } from '@modules/auth';

import type {
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import { okAsync, ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { isSameTask } from '../../domain/models/help-session';
import { parseHintSubject } from '../../domain/models/hint-subject';
import { parseChildProfileId } from '../../domain/models/ids';
import { GUIDANCE_RATE_LIMITS } from '../rate-limits';
import { spendChildBudget } from '../services/child-budget';
import { classifySessionTask } from '../services/classify-session-task';
import { parseRequestedTask, resolveSessionSource } from '../services/help-session-source';
import { toHelpSessionView } from '../services/help-session-view';
import { requireDailyBudget, requireWindowOpen } from '../services/learning-time';
import { ownChildScope } from '../services/own-child-session';

import type { HelpSessionSource } from '../../domain/models/help-session';
import type { ChildProfileId } from '../../domain/models/ids';
import type { OwnChildProfile } from '../../domain/ports/child-profile-access.port';
import type { HelpSessionOwner } from '../../domain/ports/help-session.repository';
import type { StartHelpSessionInput } from '../contracts/help-session-inputs';
import type { StartHelpSessionView } from '../contracts/help-session-views';
import type { HelpSessionDependencies } from '../help-session-dependencies';

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
            parseHintSubject(input.subject).map((subject) => ({ id, requested, subject })),
          ),
        )
        .asyncAndThen(({ id, requested, subject }) =>
          ownChildScope(this.deps, actor, id).andThen(({ owner, childProfileId, child }) =>
            requireWindowOpen(this.deps, child)
              .asyncAndThen(() => spendChildBudget(rateLimiter, { actor, childProfileId, policy }))
              .andThen(() =>
                resolveSessionSource(this.deps, { childProfileId, requested, subject }),
              )
              .andThen((source) =>
                this.startOrContinue(actor, { owner, childProfileId, child, source }),
              ),
          ),
        ),
    );
  }

  /** The open session when it is on the same task; otherwise a new one that replaces it. */
  private startOrContinue(
    actor: Actor,
    {
      owner,
      childProfileId,
      child,
      source,
    }: {
      readonly owner: HelpSessionOwner;
      readonly childProfileId: ChildProfileId;
      readonly child: OwnChildProfile;
      readonly source: HelpSessionSource;
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
        .andThen(() =>
          ResultAsync.fromSafePromise(
            classifySessionTask(this.deps, {
              child,
              task: source.task,
              subject: source.subject,
              replaces: open,
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
