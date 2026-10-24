import { describe, expect, it } from 'vitest';

import { toAuditEntry } from '@modules/audit/domain/models/audit-trail-source';
import type { AuditTrailSource } from '@modules/audit/domain/models/audit-trail-source';

import { NOW } from '../fakes';

type SampleEvent = 'member.did' | 'visitor.did' | 'noise' | 'failed';

/** An event as a module emits it: its type plus whatever fields that module's events carry. */
function ev(type: SampleEvent, fields: Record<string, unknown> = {}) {
  return { ...fields, type };
}

const SOURCE: AuditTrailSource<SampleEvent> = {
  source: 'auth',
  levels: { 'member.did': 'info', 'visitor.did': 'info', noise: 'info', failed: 'info' },
  policy: { 'member.did': 'member', 'visitor.did': 'visitor', noise: false, failed: 'visitor' },
};

describe('toAuditEntry', () => {
  it('places an event in the tenant it names, under the source and with the time it is given', () => {
    const result = toAuditEntry(ev('member.did', { tenantId: 't1', actorId: 'p1' }), SOURCE, NOW);

    expect(result).toEqual({
      tenantId: 't1',
      source: 'auth',
      type: 'member.did',
      severity: 'info',
      actor: { kind: 'member', id: 'p1' },
      details: {},
      occurredAt: NOW,
    });
  });

  it('leaves out what the policy keeps in the logs only', () => {
    expect(toAuditEntry(ev('noise', { tenantId: 't1' }), SOURCE, NOW)).toBeNull();
  });

  it('leaves out an event that names no tenant, rather than guessing one', () => {
    expect(toAuditEntry(ev('member.did', { actorId: 'p1' }), SOURCE, NOW)).toBeNull();
    expect(toAuditEntry(ev('member.did', { tenantId: 42, actorId: 'p1' }), SOURCE, NOW)).toBeNull();
  });

  it('leaves out an event of a tenant the source says is not one', () => {
    const source: AuditTrailSource<SampleEvent> = {
      ...SOURCE,
      isTenant: (id) => id !== 'platform',
    };

    expect(
      toAuditEntry(ev('member.did', { tenantId: 'platform', actorId: 'p1' }), source, NOW),
    ).toBeNull();
    expect(
      toAuditEntry(ev('member.did', { tenantId: 't1', actorId: 'p1' }), source, NOW),
    ).not.toBeNull();
  });

  it('attributes an event without an actor id to the kind the policy names, never to a member', () => {
    expect(toAuditEntry(ev('visitor.did', { tenantId: 't1' }), SOURCE, NOW)?.actor).toEqual({
      kind: 'visitor',
    });
    // A member event that names nobody was caused by nobody in particular.
    expect(toAuditEntry(ev('member.did', { tenantId: 't1' }), SOURCE, NOW)?.actor).toEqual({
      kind: 'system',
    });
  });

  it('keeps plain values as details and drops the fields that only place the event', () => {
    const result = toAuditEntry(
      ev('member.did', {
        tenantId: 't1',
        actorId: 'p1',
        permission: 'learner.read',
        count: 3,
        flag: true,
        nothing: null,
        fields: ['a', 'b'],
      }),
      SOURCE,
      NOW,
    );

    expect(result?.details).toEqual({
      permission: 'learner.read',
      count: 3,
      flag: true,
      nothing: null,
      fields: ['a', 'b'],
    });
  });

  it('never stores a structured value: an object, a function or a mixed list is dropped', () => {
    const result = toAuditEntry(
      ev('member.did', {
        tenantId: 't1',
        actorId: 'p1',
        nested: { password: 'hunter2' },
        callback: () => 'x',
        mixed: ['a', 1],
        when: NOW,
      }),
      SOURCE,
      NOW,
    );

    expect(result?.details).toEqual({});
    expect(JSON.stringify(result)).not.toContain('hunter2');
  });

  it('raises the severity to warn when the event names an error, whatever its type says', () => {
    expect(
      toAuditEntry(
        ev('failed', { tenantId: 't1', errorCode: 'auth.invalid_credentials' }),
        SOURCE,
        NOW,
      )?.severity,
    ).toBe('warn');
    expect(
      toAuditEntry(ev('failed', { tenantId: 't1', errorCode: '' }), SOURCE, NOW)?.severity,
    ).toBe('info');
  });

  it('uses the module level of the type when the event names no error', () => {
    const source: AuditTrailSource<SampleEvent> = {
      ...SOURCE,
      levels: { ...SOURCE.levels, 'member.did': 'warn' },
    };

    expect(
      toAuditEntry(ev('member.did', { tenantId: 't1', actorId: 'p1' }), source, NOW)?.severity,
    ).toBe('warn');
  });
});
