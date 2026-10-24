import { toAuditEntry } from '../../domain/models/audit-trail-source';

import type { AuditTrailSource } from '../../domain/models/audit-trail-source';
import type { AuditDependencies } from '../audit-dependencies';

/**
 * Writes module events into the trail. `record` returns at once and never
 * throws, like every audit port it stands behind: the write runs on its own,
 * and a failed write is logged by the store and costs the request nothing.
 * Shortcut: a write still in flight when the process stops is lost; when the
 * trail must be complete, write it in the same transaction as the change.
 */
export class AuditTrailRecorder {
  constructor(private readonly deps: AuditDependencies) {}

  record<T extends string>(event: { readonly type: T }, source: AuditTrailSource<T>): void {
    const entry = toAuditEntry(event, source, this.deps.clock.now());
    if (entry === null) {
      return;
    }
    // Contained on purpose: the store logs its own failure once (persistence-failures).
    void this.deps.entries.append(entry).match(
      () => undefined,
      () => undefined,
    );
  }
}
