import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { parseChildProfileId } from '../../domain/models/ids';
import { toHelpSessionView } from '../services/help-session-view';
import { ownChildScope } from '../services/own-child-session';

import type { GetOpenHelpSessionInput } from '../contracts/help-session-inputs';
import type { HelpSessionView } from '../contracts/help-session-views';
import type { HelpSessionDependencies } from '../help-session-dependencies';

export type GetOpenHelpSessionError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * "Continue" (#17): the child's open session from the server-side store, `null` when there is
 * none. It is the same after signing out or on another device, because nothing comes from the client.
 */
export class GetOpenHelpSession {
  constructor(private readonly deps: HelpSessionDependencies) {}

  execute(
    input: GetOpenHelpSessionInput,
  ): AppResultAsync<HelpSessionView | null, GetOpenHelpSessionError> {
    return this.deps.authorization
      .requireInTenant('hint.request')
      .andThen((actor) =>
        parseChildProfileId(input.childProfileId).asyncAndThen((id) =>
          ownChildScope(this.deps, actor, id).andThen(({ owner, childProfileId }) =>
            this.deps.sessions
              .findOpen(owner, childProfileId)
              .map((open) => (open === null ? null : toHelpSessionView(open))),
          ),
        ),
      );
  }
}
