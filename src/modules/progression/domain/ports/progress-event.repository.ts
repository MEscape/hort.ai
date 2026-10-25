import type { ActorId, TenantId } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ChildProfileId } from '../models/ids';
import type { NewProgressEvent, ProgressSummary } from '../models/progress';

/** Whose children an operation reaches: the signed-in parent's own, in their own tenant. */
export interface ProgressOwner {
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
}

/**
 * Persistence for the append-only XP ledger. Every read and write names the owner and the tenant,
 * so another parent's child behaves exactly like one that does not exist. Nothing is updated and
 * nothing is deleted (rows go only with their child), so no XP is ever taken away.
 */
export interface ProgressEventRepository {
  /** Total XP, latest reward and whether `dailyEventKey` is stored, for one child. */
  summarize(
    owner: ProgressOwner,
    childProfileId: ChildProfileId,
    dailyEventKey: string,
  ): AppResultAsync<ProgressSummary, InfrastructureAppError>;

  /**
   * Stores the reward with ONE insert guarded by the unique (child, key) index. `true` when this
   * call stored it, `false` when the key was stored before (a repeat or a concurrent twin): no
   * read-then-write, so two requests at once still grant it once.
   */
  insertOnce(
    owner: ProgressOwner,
    event: NewProgressEvent,
  ): AppResultAsync<boolean, InfrastructureAppError>;
}
