import { createAuditLog } from '@lib/logger';

import type {
  AssignmentAuditLog,
  AssignmentEvent,
} from '../../domain/ports/assignment-audit-log.port';

const LEVEL_BY_EVENT = {
  'assignment.created': 'info',
  'assignment.updated': 'info',
  'assignment.deleted': 'info',
} as const satisfies Record<AssignmentEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `assignments.audit`; never throws. */
export const loggerAssignmentAuditLog: AssignmentAuditLog = createAuditLog(
  'assignments.audit',
  LEVEL_BY_EVENT,
);
