import type { AuditTrailPolicy } from '@modules/audit';

import { createAuditLog } from '@lib/logger';

import type { SecurityAuditLog, SecurityEvent } from '../../domain/ports/security-audit-log.port';

/**
 * Failures and denials are `warn` so alerting can key on them; ordinary
 * lifecycle events are `info`. Exhaustive: a new event type does not
 * compile until it is given a level.
 */
export const LEVEL_BY_EVENT = {
  'authorization.denied': 'warn',
  'authentication.sign_in_failed': 'warn',
  'authentication.session_created': 'info',
  'authentication.session_revoked': 'info',
  'authentication.account_created': 'info',
  'authentication.password_reset_completed': 'info',
} as const satisfies Record<SecurityEvent['type'], 'info' | 'warn'>;

/** One structured log line per event under `auth.audit`; never throws. */
export const loggerSecurityAuditLog: SecurityAuditLog = createAuditLog(
  'auth.audit',
  LEVEL_BY_EVENT,
);

/**
 * Which events the durable trail keeps, and the kind of actor behind each. Every event of this module names
 * its tenant, so none is dropped for lack of one. A failed sign-in names no account (the address is not
 * recorded), so it is a visitor's act; the others name the parent they happened to. Exhaustive per event type.
 */
export const TRAIL_BY_EVENT = {
  'authorization.denied': 'member',
  'authentication.sign_in_failed': 'visitor',
  'authentication.session_created': 'member',
  'authentication.session_revoked': 'member',
  'authentication.account_created': 'member',
  'authentication.password_reset_completed': 'member',
} as const satisfies AuditTrailPolicy<SecurityEvent['type']>;
