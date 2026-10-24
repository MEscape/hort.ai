import 'server-only';

import { systemClock } from '@lib/clock';
import { serverEnv } from '@lib/config/server';
import { MS_PER_DAY, once } from '@lib/utils';

import { PruneAuditTrail } from './application/commands/prune-audit-trail';
import { GetAllTenantsAuditTrail } from './application/queries/get-all-tenants-audit-trail';
import { GetAuditDigest } from './application/queries/get-audit-digest';
import { GetAuditTrail } from './application/queries/get-audit-trail';
import { AuditTrailRecorder } from './application/services/audit-trail-recorder';
import { loggerTrailAuditLog } from './infrastructure/audit/logger-trail-audit-log';
import { PrismaAuditTrailRepository } from './infrastructure/prisma/prisma-audit-trail.repository';

import type { AuditTrailSource } from './application/contracts/audit-views';

/**
 * The module's composition root: the one file that knows both the use cases
 * and their adapters. `server-only` makes an accidental import from a Client
 * Component a build error.
 */
const dependencies = { entries: new PrismaAuditTrailRepository(), clock: systemClock };
const recorder = new AuditTrailRecorder(dependencies);

export const auditQueries = {
  getAuditTrail: new GetAuditTrail(dependencies),
  getAllWebsitesAuditTrail: new GetAllTenantsAuditTrail(dependencies),
  getAuditDigest: new GetAuditDigest(dependencies),
} as const;

/**
 * A module's audit port that still writes its log lines and also keeps, in
 * the trail, the events its policy keeps. Another module's composition root
 * wraps its own log with this, the one place it wires the audit module in;
 * none of its use cases learns that the trail exists.
 */
export function withAuditTrail<E extends { readonly type: string }>(
  log: { record(event: E): void },
  source: AuditTrailSource<E['type']>,
): { record(event: E): void } {
  return {
    record(event) {
      log.record(event);
      recorder.record(event, source);
    },
  };
}

const pruneAuditTrail = new PruneAuditTrail({
  ...dependencies,
  audit: loggerTrailAuditLog,
  retentionDays: serverEnv.AUDIT_RETENTION_DAYS,
});

/**
 * Keeps the trail to its retention: once at server start, then daily. The
 * app runs as one long-lived Node.js server (`next start`), so the process's
 * own timer is the schedule; several instances deleting the same old rows is
 * harmless. A failed run is logged by the store and retried the next day.
 * `unref` lets the process exit without waiting for it.
 */
export const startAuditRetention = once((): void => {
  const run = () => {
    void pruneAuditTrail.execute();
  };
  run();
  setInterval(run, MS_PER_DAY).unref();
});
