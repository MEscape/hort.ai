import { createAuditLog } from '@lib/logger';

import type { GuidanceAuditLog, GuidanceEvent } from '../../domain/ports/guidance-audit-log.port';

/**
 * A request or an answer check is a significant event (`info`). A fallback is a recoverable anomaly: the child got
 * help, but not the AI's. `warn` lets alerting notice a provider that keeps failing or a model that
 * keeps breaking the rules; that holds for the topic classification (#92) too. A hint without curriculum grounding still helps the child, but its cause
 * must be visible, so that is `warn` too.
 */
export const LEVEL_BY_EVENT = {
  'guidance.hint_fallback_used': 'warn',
  'guidance.feedback_fallback_used': 'warn',
  'guidance.grounding_unavailable': 'warn',
  'guidance.hint_requested': 'info',
  'guidance.answer_checked': 'info',
  'guidance.topic_classification_fallback_used': 'warn',
  'guidance.topic_classified': 'info',
  'guidance.child_task_classified': 'info',
  'guidance.topic_subject_mismatch': 'info',
} as const satisfies Record<GuidanceEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `guidance.audit`; never throws. */
export const loggerGuidanceAuditLog: GuidanceAuditLog = createAuditLog(
  'guidance.audit',
  LEVEL_BY_EVENT,
);
