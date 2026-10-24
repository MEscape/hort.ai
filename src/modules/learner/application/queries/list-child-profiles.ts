import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { clamp, isDefined } from '@lib/utils';

import {
  DEFAULT_CHILD_PROFILE_LIST_LIMIT,
  MAX_CHILD_PROFILE_LIST_LIMIT,
  MIN_CHILD_PROFILE_LIST_LIMIT,
} from '../learner-limits';
import { toChildProfileView } from '../learner-view-mappers';

import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';

export interface ListChildProfilesOptions {
  readonly limit?: number;
}

/** Lists the signed-in parent's own child profiles, most recently changed first. Always bounded. */
export class ListChildProfiles {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(
    options: ListChildProfilesOptions = {},
  ): AppResultAsync<readonly ChildProfileView[], AuthorizationError | InfrastructureAppError> {
    const requested =
      isDefined(options.limit) && Number.isInteger(options.limit)
        ? options.limit
        : DEFAULT_CHILD_PROFILE_LIST_LIMIT;
    const limit = clamp(requested, MIN_CHILD_PROFILE_LIST_LIMIT, MAX_CHILD_PROFILE_LIST_LIMIT);

    return this.deps.authorization
      .requireInTenant('learner.read')
      .andThen((actor) => this.deps.childProfiles.listByOwner(actor.tenantId, actor.id, limit))
      .map((childProfiles) => childProfiles.map(toChildProfileView));
  }
}
