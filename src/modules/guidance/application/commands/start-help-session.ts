import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseChildTaskText } from '../../domain/models/child-task-text';
import { isSameTask } from '../../domain/models/help-session';
import { parseHintSubject } from '../../domain/models/hint-subject';
import { parseChildProfileId } from '../../domain/models/ids';
import { toHelpSessionView } from '../services/help-session-view';
import { ownChildScope } from '../services/own-child-session';

import type { StartHelpSessionInput } from '../contracts/help-session-inputs';
import type { StartHelpSessionView } from '../contracts/help-session-views';
import type { HelpSessionDependencies } from '../help-session-dependencies';

export type StartHelpSessionError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * A parent's child starts a help session on their own task (#17). The child has at most one open
 * session: the same task again continues it (so a retried start creates nothing), a different
 * task ends the open one as `abandoned` and starts anew, in one transaction.
 *
 * `hint.request` is the guidance capability of the child's guardian, as for hints themselves. No
 * rate limit: a start costs no provider call, and the one-open-session rule bounds what it stores.
 */
export class StartHelpSession {
  constructor(private readonly deps: HelpSessionDependencies) {}

  execute(
    input: StartHelpSessionInput,
  ): AppResultAsync<StartHelpSessionView, StartHelpSessionError> {
    const { authorization, sessions, audit } = this.deps;

    return authorization.requireInTenant('hint.request').andThen((actor) =>
      parseChildProfileId(input.childProfileId)
        .andThen((id) =>
          parseChildTaskText(input.task).andThen((task) =>
            parseHintSubject(input.subject).map((subject) => ({ id, task, subject })),
          ),
        )
        .asyncAndThen(({ id, task, subject }) =>
          ownChildScope(this.deps, actor, id).andThen(({ owner, childProfileId }) =>
            sessions.findOpen(owner, childProfileId).andThen((open) => {
              if (open !== null && isSameTask(open, task, subject)) {
                return okAsync<StartHelpSessionView>({
                  outcome: 'continued',
                  session: toHelpSessionView(open),
                });
              }
              const replaces = open?.id ?? null;
              return sessions
                .start(owner, { childProfileId, task, subject, replaces })
                .map(({ session, created }): StartHelpSessionView => {
                  if (created) {
                    audit.record({
                      type: 'guidance.session_started',
                      tenantId: actor.tenantId,
                      actorId: actor.id,
                      childProfileId,
                      sessionId: session.id,
                      subject,
                      replaced: replaces,
                    });
                  }
                  return {
                    outcome: created ? 'started' : 'continued',
                    session: toHelpSessionView(session),
                  };
                });
            }),
          ),
        ),
    );
  }
}
