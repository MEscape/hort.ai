import { createAuditLog } from '@lib/logger';

import type { GuidanceAuditLog, GuidanceEvent } from '../../domain/ports/guidance-audit-log.port';

/**
 * A request is a significant event (`info`). A fallback is a recoverable anomaly: the child got
 * help, but not the AI's. `warn` lets alerting notice a provider that keeps failing or a model that
 * keeps breaking the rules.
 */
export const LEVEL_BY_EVENT = {
  'guidance.hint_fallback_used': 'warn',
  'guidance.hint_requested': 'info',
} as const satisfies Record<GuidanceEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `guidance.audit`; never throws. */
export const loggerGuidanceAuditLog: GuidanceAuditLog = createAuditLog(
  'guidance.audit',
  LEVEL_BY_EVENT,
);
