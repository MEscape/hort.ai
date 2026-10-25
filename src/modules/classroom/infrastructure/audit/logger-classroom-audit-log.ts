import { createAuditLog } from '@lib/logger';

import type {
  ClassroomAuditLog,
  ClassroomEvent,
} from '../../domain/ports/classroom-audit-log.port';

/** Refusals are `warn` so alerting can key on a guessing run. Exhaustive per event type. */
const LEVEL_BY_EVENT = {
  'classroom.created': 'info',
  'classroom.renamed': 'info',
  'classroom.archived': 'info',
  'classroom.invite_code_regenerated': 'info',
  'classroom.child_joined': 'info',
  'classroom.child_left': 'info',
  'classroom.join_refused': 'warn',
} as const satisfies Record<ClassroomEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `classroom.audit`; never throws. */
export const loggerClassroomAuditLog: ClassroomAuditLog = createAuditLog(
  'classroom.audit',
  LEVEL_BY_EVENT,
);
