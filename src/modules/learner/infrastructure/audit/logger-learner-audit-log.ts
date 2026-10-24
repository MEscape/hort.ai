import { createAuditLog } from '@lib/logger';

import type { LearnerAuditLog, LearnerEvent } from '../../domain/ports/learner-audit-log.port';

/** Failures are `warn` so alerting can key on them. Exhaustive per event type. */
const LEVEL_BY_EVENT = {
  'child_profile.created': 'info',
  'child_profile.updated': 'info',
  'child_profile.deleted': 'info',
} as const satisfies Record<LearnerEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `learner.audit`; never throws. */
export const loggerLearnerAuditLog: LearnerAuditLog = createAuditLog(
  'learner.audit',
  LEVEL_BY_EVENT,
);
