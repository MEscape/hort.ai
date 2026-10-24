import type { AuditTrailPolicy } from '@modules/audit';

import { createAuditLog } from '@lib/logger';

import type { LearnerAuditLog, LearnerEvent } from '../../domain/ports/learner-audit-log.port';

/** All ordinary lifecycle events, so `info`. Exhaustive: a new event type does not compile until it has a level. */
export const LEVEL_BY_EVENT = {
  'learner.profile_created': 'info',
  'learner.interests_saved': 'info',
  'learner.tutor_chosen': 'info',
  'learner.controls_changed': 'info',
  'learner.guardian_consent_recorded': 'info',
  'learner.setup_completed': 'info',
} as const satisfies Record<LearnerEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `learner.audit`; never throws. */
export const loggerLearnerAuditLog: LearnerAuditLog = createAuditLog(
  'learner.audit',
  LEVEL_BY_EVENT,
);

/**
 * Which events the durable trail keeps, and the kind of actor behind each. Every event names the
 * parent who caused it and its tenant. Exhaustive per event type.
 */
export const TRAIL_BY_EVENT = {
  'learner.profile_created': 'member',
  'learner.interests_saved': 'member',
  'learner.tutor_chosen': 'member',
  'learner.controls_changed': 'member',
  'learner.guardian_consent_recorded': 'member',
  'learner.setup_completed': 'member',
} as const satisfies AuditTrailPolicy<LearnerEvent['type']>;
