/**
 * Server-side public API of the audit module: the durable trail every module
 * feeds through `withAuditTrail` in its composition root, and the queries a
 * screen reads it with after authorizing the reader. The module has no
 * presentation layer yet; a future one adds its components here and a
 * browser-safe `client.ts`.
 */

export { auditQueries, startAuditRetention, withAuditTrail } from './composition';

export {
  AUDIT_PERIODS,
  AUDIT_SOURCES,
  DEFAULT_AUDIT_PERIOD,
  EMPTY_AUDIT_FILTER,
} from './application/contracts/audit-views';
export type {
  AuditActorFilter,
  AuditActorKind,
  AuditDayView,
  AuditDetails,
  AuditDetailValue,
  AuditDigestView,
  AuditEntryView,
  AuditFilter,
  AuditPageOptions,
  AuditPeriod,
  AuditSeverity,
  AuditSource,
  AuditTrailPolicy,
  AuditTrailSource,
  AuditTrailView,
  AuditTypeCountView,
} from './application/contracts/audit-views';
