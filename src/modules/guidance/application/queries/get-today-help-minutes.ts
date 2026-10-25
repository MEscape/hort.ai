import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { parseChildProfileId } from '../../domain/models/ids';
import { ownChildScope, todayHelpMinutes } from '../services/own-child-session';

import type { GetOpenHelpSessionInput } from '../contracts/help-session-inputs';
import type { HelpSessionDependencies } from '../help-session-dependencies';

export type GetTodayHelpMinutesError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * The minutes the child spent in help sessions today, for Home's time strip: the same count the
 * daily limit is enforced against, so the strip and the use cases agree.
 */
export class GetTodayHelpMinutes {
  constructor(private readonly deps: HelpSessionDependencies) {}

  execute(input: GetOpenHelpSessionInput): AppResultAsync<number, GetTodayHelpMinutesError> {
    return this.deps.authorization
      .requireInTenant('hint.request')
      .andThen((actor) =>
        parseChildProfileId(input.childProfileId).asyncAndThen((id) =>
          ownChildScope(this.deps, actor, id).andThen(({ owner, childProfileId }) =>
            todayHelpMinutes(this.deps, owner, childProfileId),
          ),
        ),
      );
  }
}
