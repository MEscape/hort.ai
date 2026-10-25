import { createAuditLog } from '@lib/logger';

import type {
  CurriculumAuditLog,
  CurriculumEvent,
} from '../../domain/ports/curriculum-audit-log.port';

export const LEVEL_BY_EVENT = {
  'curriculum.document_ingested': 'info',
} as const satisfies Record<CurriculumEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `curriculum.audit`; never throws. */
export const loggerCurriculumAuditLog: CurriculumAuditLog = createAuditLog(
  'curriculum.audit',
  LEVEL_BY_EVENT,
);
