import type { Actor } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { dayKeyOf } from '../../domain/models/day';
import { dailyEventKey } from '../../domain/models/xp-rules';
import { toProgressView } from '../progression-view-mappers';

import type { ChildProfileId } from '../../domain/models/ids';
import type { ProgressView } from '../contracts/progression-views';
import type { ProgressionDependencies } from '../progression-dependencies';

/** Who reads which child's progress, and at what time. */
export interface ProgressContext {
  readonly actor: Actor;
  readonly childProfileId: ChildProfileId;
  readonly now: Date;
}

/** The child's progress at `now`, read from the ledger for the actor's own tenant and ownership. */
export function readProgress(
  deps: ProgressionDependencies,
  { actor, childProfileId, now }: ProgressContext,
): AppResultAsync<ProgressView, InfrastructureAppError> {
  return deps.progress
    .summarize(
      { tenantId: actor.tenantId, ownerId: actor.id },
      childProfileId,
      dailyEventKey(dayKeyOf(now)),
    )
    .map((summary) => toProgressView(childProfileId, summary, now));
}
