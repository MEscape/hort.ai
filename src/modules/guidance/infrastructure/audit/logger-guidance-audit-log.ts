import { createAuditLog } from '@lib/logger';

import type { GuidanceAuditLog, GuidanceEvent } from '../../domain/ports/guidance-audit-log.port';

/**
 * A request or an answer check is a significant event (`info`). A fallback is a recoverable anomaly: the child got
 * help, but not the AI's. `warn` lets alerting notice a provider that keeps failing or a model that
 * keeps breaking the rules; that holds for the topic classification (#92) too. A step the session
 * could not store is `warn`: the child got it, but the learning record has a gap. A hint without
 * curriculum grounding still helps the child, but its cause
 * must be visible, so that is `warn` too, as is a step on an assignment that went ahead without the
 * teacher's key, or a step whose stored competency no longer grounds the child.
 */
export const LEVEL_BY_EVENT = {
  'guidance.hint_fallback_used': 'warn',
  'guidance.feedback_fallback_used': 'warn',
  'guidance.grounding_unavailable': 'warn',
  'guidance.stored_competency_unavailable': 'warn',
  'guidance.hint_requested': 'info',
  'guidance.answer_checked': 'info',
  'guidance.step_not_recorded': 'warn',
  'guidance.solution_key_unavailable': 'warn',
  'guidance.session_started': 'info',
  'guidance.comprehension_replied': 'info',
  'guidance.topic_classification_fallback_used': 'warn',
  'guidance.topic_classified': 'info',
  'guidance.topic_subject_mismatch': 'info',
} as const satisfies Record<GuidanceEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `guidance.audit`; never throws. */
export const loggerGuidanceAuditLog: GuidanceAuditLog = createAuditLog(
  'guidance.audit',
  LEVEL_BY_EVENT,
);
