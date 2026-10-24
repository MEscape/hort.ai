import { describe, expect, it } from 'vitest';

import {
  ACTOR_KIND_RECORD,
  SEVERITY_RECORD,
  toAuditEntry,
} from '@modules/audit/infrastructure/prisma/audit-trail-record-mapper';
import type { AuditEntryRecord } from '@modules/audit/infrastructure/prisma/audit-trail-record-mapper';

const OCCURRED = '2026-06-15T10:30:00.000Z';

function record(overrides: Partial<AuditEntryRecord> = {}): AuditEntryRecord {
  return {
    id: 'e1',
    tenantId: 'default',
    source: 'auth',
    type: 'authorization.denied',
    severity: 'WARN',
    actorKind: 'MEMBER',
    actorId: 'parent-1',
    details: { permission: 'learner.read', reason: 'owner_mismatch' },
    occurredAt: { epochMilliseconds: Date.parse(OCCURRED) },
    ...overrides,
  };
}

describe('toAuditEntry (record mapper)', () => {
  it('maps a stored row onto the domain entry', () => {
    expect(toAuditEntry(record())).toEqual({
      id: 'e1',
      tenantId: 'default',
      source: 'auth',
      type: 'authorization.denied',
      severity: 'warn',
      actor: { kind: 'member', id: 'parent-1' },
      details: { permission: 'learner.read', reason: 'owner_mismatch' },
      occurredAt: new Date(OCCURRED),
    });
  });

  it('skips an entry of an area this build does not know, instead of showing something unfilterable', () => {
    expect(toAuditEntry(record({ source: 'media' }))).toBeNull();
  });

  it('reads a member row without an id as the system, never dropping the entry', () => {
    expect(toAuditEntry(record({ actorId: null }))?.actor).toEqual({ kind: 'system' });
  });

  it('reads visitor and system rows as such', () => {
    expect(toAuditEntry(record({ actorKind: 'VISITOR', actorId: null }))?.actor).toEqual({
      kind: 'visitor',
    });
    expect(toAuditEntry(record({ actorKind: 'SYSTEM', actorId: null }))?.actor).toEqual({
      kind: 'system',
    });
  });

  it('reads stored details as plain values only', () => {
    const result = toAuditEntry(
      record({ details: { ok: 'x', n: 1, nested: { a: 1 }, list: ['a'], mixed: ['a', 2] } }),
    );

    expect(result?.details).toEqual({ ok: 'x', n: 1, list: ['a'] });
  });

  it('reads details that are not an object as empty', () => {
    expect(toAuditEntry(record({ details: 'oops' }))?.details).toEqual({});
    expect(toAuditEntry(record({ details: null }))?.details).toEqual({});
  });

  it('keeps the stored spelling of every domain value, in both directions', () => {
    expect(SEVERITY_RECORD).toEqual({ info: 'INFO', warn: 'WARN' });
    expect(ACTOR_KIND_RECORD).toEqual({ member: 'MEMBER', visitor: 'VISITOR', system: 'SYSTEM' });
  });
});
