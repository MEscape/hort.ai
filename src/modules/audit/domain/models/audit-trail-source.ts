import { toActorId, toTenantId } from './ids';

import type {
  AuditActor,
  AuditActorKind,
  AuditDetailValue,
  AuditSeverity,
  AuditSource,
  NewAuditEntry,
} from './audit-entry';

/**
 * Which of a module's events the trail keeps, per event type: the kind of
 * actor behind it when the event names no `actorId` (`member` when it always
 * names one), or `false` for operational noise (an abandoned draft, a
 * housekeeping sweep) that stays in the logs only. Exhaustive like the
 * module's level table, so a new event type does not compile until someone
 * decides whether it belongs in the trail.
 */
export type AuditTrailPolicy<T extends string> = Readonly<Record<T, AuditActorKind | false>>;

/** Everything the trail needs to know about one module's events. */
export interface AuditTrailSource<T extends string> {
  readonly source: AuditSource;
  /** The module's own log levels; `warn` becomes a warning in the trail. */
  readonly levels: Readonly<Record<T, AuditSeverity>>;
  readonly policy: AuditTrailPolicy<T>;
  /**
   * Whether a tenant id names a real tenant. Only needed by a module whose
   * actors can stand outside every tenant (auth: the platform scope, an
   * account without a tenant), whose events then stay out of the trail.
   */
  readonly isTenant?: (tenantId: string) => boolean;
}

/** Fields that place an event (where, who), as opposed to the ones that describe it. */
const PLACEMENT_FIELDS: ReadonlySet<string> = new Set(['type', 'tenantId', 'actorId']);

function toDetailValue(value: unknown): AuditDetailValue | undefined {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value;
  }
  return undefined;
}

function actorOf(actorId: unknown, kind: AuditActorKind): AuditActor {
  if (typeof actorId === 'string') {
    return { kind: 'member', id: toActorId(actorId) };
  }
  // An event of a member's action names its actor; one that does not was caused by nobody in particular.
  return kind === 'member' ? { kind: 'system' } : { kind };
}

/** The module's level, raised to `warn` when the event names an error: the same rule as its log line (`auditLevelOf`). */
function severityOf<T extends string>(
  levels: Readonly<Record<T, AuditSeverity>>,
  event: { readonly type: T },
): AuditSeverity {
  const { errorCode } = event as { readonly errorCode?: unknown };
  return typeof errorCode === 'string' && errorCode !== '' ? 'warn' : levels[event.type];
}

/**
 * The trail entry for one module event, or `null` when the trail does not
 * keep it: the policy leaves it out, or it names no tenant. The event's
 * `tenantId` places it. Events are free of content and personal data by their
 * own contract; this keeps only plain values, so nothing structured slips
 * into the trail.
 */
export function toAuditEntry<T extends string>(
  event: { readonly type: T },
  source: AuditTrailSource<T>,
  occurredAt: Date,
): NewAuditEntry | null {
  const kind = source.policy[event.type];
  if (kind === false) {
    return null;
  }
  const fields = new Map<string, unknown>(Object.entries(event));
  const tenant = fields.get('tenantId');
  if (typeof tenant !== 'string' || !(source.isTenant?.(tenant) ?? true)) {
    return null;
  }

  const details: Record<string, AuditDetailValue> = {};
  for (const [name, value] of fields) {
    const detail = PLACEMENT_FIELDS.has(name) ? undefined : toDetailValue(value);
    if (detail !== undefined) {
      details[name] = detail;
    }
  }

  return {
    tenantId: toTenantId(tenant),
    source: source.source,
    type: event.type,
    severity: severityOf(source.levels, event),
    actor: actorOf(fields.get('actorId'), kind),
    details,
    occurredAt,
  };
}
