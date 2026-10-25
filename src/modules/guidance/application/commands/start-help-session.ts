import type { Actor, AuthorizationError } from '@modules/auth';

import type {
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import { ok, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { isSameTask } from '../../domain/models/help-session';
import { parseHintSubject } from '../../domain/models/hint-subject';
import { parseChildProfileId } from '../../domain/models/ids';
import { GUIDANCE_RATE_LIMITS } from '../rate-limits';
import { spendChildBudget } from '../services/child-budget';
import { checkForDistress } from '../services/distress-check';
import { parseRequestedTask, resolveSessionSource } from '../services/help-session-source';
import { toHelpSessionView } from '../services/help-session-view';
import { ownChildScope } from '../services/own-child-session';

import type { HelpSessionSource } from '../../domain/models/help-session';
import type { ChildProfileId } from '../../domain/models/ids';
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
 * `hint.request` is the guidance capability of the child's guardian, as for hints themselves. A start
 * costs no provider call, but every new task stores a session, so it spends the child's
 * `sessionStart` budget once the child is known to be the parent's own.
 */
export class StartHelpSession {
  constructor(private readonly deps: HelpSessionDependencies) {}

  execute(
    input: StartHelpSessionInput,
  ): AppResultAsync<StartHelpSessionView, StartHelpSessionError> {
    const { authorization, rateLimiter, audit } = this.deps;
    const policy = GUIDANCE_RATE_LIMITS.sessionStart;

    return authorization.requireInTenant('hint.request').andThen((actor) =>
      parseChildProfileId(input.childProfileId)
        .andThen((id) =>
          parseRequestedTask(input)
            .andThen((requested) =>
              requested.kind === 'own'
                ? checkForDistress(audit, requested.task, 'task').map(() => requested)
                : ok(requested),
            )
            .andThen((requested) =>
              parseHintSubject(input.subject).map((subject) => ({ id, requested, subject })),
            ),
        )
        .asyncAndThen(({ id, requested, subject }) =>
          ownChildScope(this.deps, actor, id).andThen(({ owner, childProfileId }) =>
            spendChildBudget(rateLimiter, { actor, childProfileId, policy })
              .andThen(() =>
                resolveSessionSource(this.deps, { childProfileId, requested, subject }),
              )
              .andThen((source) => this.startOrContinue(actor, { owner, childProfileId, source })),
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
      source,
    }: {
      readonly owner: HelpSessionOwner;
      readonly childProfileId: ChildProfileId;
      readonly source: HelpSessionSource;
    },
  ): AppResultAsync<StartHelpSessionView, InfrastructureAppError> {
    const { sessions, audit } = this.deps;

    return sessions.findOpen(owner, childProfileId).andThen((open) => {
      if (open !== null && isSameTask(open, source)) {
        return okAsync<StartHelpSessionView>({
          outcome: 'continued',
          session: toHelpSessionView(open),
        });
      }
      const replaces = open?.id ?? null;
      return sessions
        .start(owner, { childProfileId, ...source, replaces })
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
