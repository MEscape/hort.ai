import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedChild } from '../services/load-authorized-child';
import { readProgress } from '../services/read-progress';

import type { GetProgressInput } from '../contracts/progression-inputs';
import type { ProgressView } from '../contracts/progression-views';
import type { ProgressionDependencies } from '../progression-dependencies';
import type { LoadChildError } from '../services/load-authorized-child';

export type GetProgressError = LoadChildError;

/**
 * The child's XP, level, today's daily reward and the companion's mood. Everything is derived from
 * the stored rewards when it is read; reading changes nothing, so opening or refreshing a screen
 * can never earn anything.
 */
export class GetProgress {
  constructor(private readonly deps: ProgressionDependencies) {}

  execute(input: GetProgressInput): AppResultAsync<ProgressView, GetProgressError> {
    return loadAuthorizedChild(this.deps, input.childProfileId, 'progression.read').andThen(
      ({ actor, childProfileId }) =>
        readProgress(this.deps, { actor, childProfileId, now: this.deps.clock.now() }),
    );
  }
}
