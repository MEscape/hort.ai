import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { MS_PER_DAY } from '@lib/utils';

import type { AuditRetentionDependencies } from '../audit-dependencies';

/**
 * Deletes the entries older than the configured retention, for every tenant
 * at once: an entry past it is no longer kept for anyone. Answers how many
 * went, which the log records.
 *
 * @authorization system Runs on the server's own daily schedule; no request and no actor are involved.
 */
export class PruneAuditTrail {
  constructor(private readonly deps: AuditRetentionDependencies) {}

  execute(): AppResultAsync<number, InfrastructureAppError> {
    const { entries, clock, audit, retentionDays } = this.deps;
    const cutoff = new Date(clock.now().getTime() - retentionDays * MS_PER_DAY);

    return entries.deleteOlderThan(cutoff).map((deletedCount) => {
      audit.record({ type: 'audit.pruned', deletedCount, retentionDays });
      return deletedCount;
    });
  }
}
