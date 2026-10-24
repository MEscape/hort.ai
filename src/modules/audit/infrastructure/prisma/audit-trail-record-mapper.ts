import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import { isJsonRecord, literalGuard } from '@lib/utils';

import { AUDIT_SOURCES } from '../../domain/models/audit-entry';
import { toActorId, toTenantId } from '../../domain/models/ids';

import type {
  AuditActor,
  AuditActorKind,
  AuditDetailValue,
  AuditDetails,
  AuditEntry,
  AuditSeverity,
} from '../../domain/models/audit-entry';

/** The columns the module reads, and nothing else, so no generated database type leaves this layer. */
export interface AuditEntryRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly source: string;
  readonly type: string;
  readonly severity: string;
  readonly actorKind: string;
  readonly actorId: string | null;
  readonly details: unknown;
  readonly occurredAt: InstantRecord;
}

export const AUDIT_ENTRY_SELECT = [
  'id',
  'tenantId',
  'source',
  'type',
  'severity',
  'actorKind',
  'actorId',
  'details',
  'occurredAt',
] as const satisfies ReadonlyArray<keyof AuditEntryRecord>;

/** The stored enum spelling of each domain value. */
export const SEVERITY_RECORD = {
  info: 'INFO',
  warn: 'WARN',
} as const satisfies Record<AuditSeverity, string>;

export const ACTOR_KIND_RECORD = {
  member: 'MEMBER',
  visitor: 'VISITOR',
  system: 'SYSTEM',
} as const satisfies Record<AuditActorKind, string>;

const isSource = literalGuard(AUDIT_SOURCES);

/** An actor whose stored kind or id does not add up reads as the system: an entry is never dropped for it. */
function toActor(record: Pick<AuditEntryRecord, 'actorKind' | 'actorId'>): AuditActor {
  if (record.actorKind === ACTOR_KIND_RECORD.member && record.actorId !== null) {
    return { kind: 'member', id: toActorId(record.actorId) };
  }
  return record.actorKind === ACTOR_KIND_RECORD.visitor ? { kind: 'visitor' } : { kind: 'system' };
}

function isDetailValue(value: unknown): value is AuditDetailValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

/** Stored details are read as plain values only; anything else is left out rather than trusted. */
function toDetails(stored: unknown): AuditDetails {
  if (!isJsonRecord(stored)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(stored).flatMap(([name, value]) =>
      isDetailValue(value) ? [[name, value] as const] : [],
    ),
  );
}

/** `null` for an entry of an area this build no longer knows: it cannot be filtered or named. */
export function toAuditEntry(record: AuditEntryRecord): AuditEntry | null {
  if (!isSource(record.source)) {
    return null;
  }
  return {
    id: record.id,
    tenantId: toTenantId(record.tenantId),
    source: record.source,
    type: record.type,
    severity: record.severity === SEVERITY_RECORD.warn ? 'warn' : 'info',
    actor: toActor(record),
    details: toDetails(record.details),
    occurredAt: instantToDate(record.occurredAt),
  };
}
