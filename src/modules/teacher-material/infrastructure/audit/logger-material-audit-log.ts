import { createAuditLog } from '@lib/logger';

import type { MaterialAuditLog, MaterialEvent } from '../../domain/ports/material-audit-log.port';

const LEVEL_BY_EVENT = {
  'material.upload_started': 'info',
  'material.processed': 'info',
  'material.deleted': 'info',
} as const satisfies Record<MaterialEvent['type'], 'info' | 'warn'>;

/** Only event IDs cross the audit boundary; no child data, file content or capabilities. */
export const loggerMaterialAuditLog: MaterialAuditLog = createAuditLog<MaterialEvent['type']>(
  'teacher-material.audit',
  LEVEL_BY_EVENT,
);
