import type { Clock } from '@lib/clock';

import type { AuditTrailRepository } from '../domain/ports/audit-trail.repository';
import type { TrailAuditLog } from '../domain/ports/trail-audit-log.port';

/**
 * What every audit use case is built from. There is no authorization service
 * on purpose: the trail is written by modules that already authorized the
 * action it records, and read through the module that serves the screen,
 * which authorizes the reader (`audit.read`) before it asks. The audit module
 * depends on no other module, so every module, the auth module included, can
 * feed it.
 */
export interface AuditDependencies {
  readonly entries: AuditTrailRepository;
  readonly clock: Clock;
}

/** What keeping the trail to its retention is built from. */
export interface AuditRetentionDependencies extends AuditDependencies {
  readonly audit: TrailAuditLog;
  /** How many days an entry is kept; validated configuration. */
  readonly retentionDays: number;
}
