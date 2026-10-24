import { createAuditLog } from '@lib/logger';

import type { TrailAuditLog, TrailEvent } from '../../domain/ports/trail-audit-log.port';

/** Deleting old entries is routine housekeeping. Exhaustive per event type. */
const LEVEL_BY_EVENT = {
  'audit.pruned': 'info',
} as const satisfies Record<TrailEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `audit.audit`; never throws. */
export const loggerTrailAuditLog: TrailAuditLog = createAuditLog('audit.audit', LEVEL_BY_EVENT);
