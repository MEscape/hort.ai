import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { parseChildProfileId } from '../../domain/models/ids';
import { HOMEWORK_AREA_IDS_MAX } from '../guidance-limits';
import { ownChildScope } from '../services/own-child-session';

import type { GetOpenHelpSessionInput } from '../contracts/help-session-inputs';
import type { HelpSessionDependencies } from '../help-session-dependencies';

export type GetHomeworkAreaIdsError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * The world islands the child did homework on, each once: the islands of its stored sessions that
 * opened as help (a clarifying question or a redirect never counts). A session the child switched
 * away from still counts, since real homework started there. It is what clears an island's mist;
 * nothing is counted or ranked, and a session never loses its island.
 */
export class GetHomeworkAreaIds {
  constructor(private readonly deps: HelpSessionDependencies) {}

  execute(
    input: GetOpenHelpSessionInput,
  ): AppResultAsync<readonly string[], GetHomeworkAreaIdsError> {
    return this.deps.authorization
      .requireInTenant('hint.request')
      .andThen((actor) =>
        parseChildProfileId(input.childProfileId).asyncAndThen((id) =>
          ownChildScope(this.deps, actor, id).andThen(({ owner, childProfileId }) =>
            this.deps.sessions.homeworkAreaIds(owner, childProfileId, HOMEWORK_AREA_IDS_MAX),
          ),
        ),
      );
  }
}
