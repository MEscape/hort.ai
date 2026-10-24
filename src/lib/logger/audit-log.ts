import { logger } from './logger';

/** Failures and denials are `warn` so alerting can key on them; ordinary lifecycle events are `info`. */
export type AuditLevel = 'info' | 'warn';

/**
 * The level of one event: the one its module chose for the type, raised to
 * `warn` when the event carries an error code, since an event that names an
 * error reports a failure (a connection test that failed) even when its type
 * also covers success.
 */
export function auditLevelOf<T extends string>(
  levels: Readonly<Record<T, AuditLevel>>,
  event: { readonly type: T },
): AuditLevel {
  const { errorCode } = event as { readonly errorCode?: unknown };
  return typeof errorCode === 'string' && errorCode !== '' ? 'warn' : levels[event.type];
}

/** Satisfies any module's audit port whose events have one of the types `T`. */
export interface AuditRecorder<T extends string> {
  record(event: { readonly type: T }): void;
}

/**
 * The one implementation behind every module's audit port: each event
 * becomes one structured log line under `module`, at the level the module
 * chose for its type, with the rest of the event as context. Never throws:
 * auditing must never fail the request it describes. Modules own their
 * event types and levels; this owns the mechanism.
 */
export function createAuditLog<T extends string>(
  module: string,
  levels: Readonly<Record<T, AuditLevel>>,
): AuditRecorder<T> {
  const auditLogger = logger.withContext({ module });
  return {
    record(event) {
      const { type, ...details } = event;
      try {
        auditLogger[auditLevelOf(levels, event)](type, details);
      } catch {
        // Contained on purpose, see above.
      }
    },
  };
}
