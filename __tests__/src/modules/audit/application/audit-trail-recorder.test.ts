import { describe, expect, it } from 'vitest';

import { AuditTrailRecorder } from '@modules/audit/application/services/audit-trail-recorder';
import type { AuditTrailSource } from '@modules/audit/domain/models/audit-trail-source';

import { NOW, STORE_DOWN, clock, fakeRepository } from '../fakes';

type SampleEvent = 'kept' | 'logged_only';

/** An event as a module emits it: its type plus whatever fields that module's events carry. */
function ev(type: SampleEvent, fields: Record<string, unknown> = {}) {
  return { ...fields, type };
}

const SOURCE: AuditTrailSource<SampleEvent> = {
  source: 'auth',
  levels: { kept: 'info', logged_only: 'info' },
  policy: { kept: 'member', logged_only: false },
};

describe('AuditTrailRecorder', () => {
  it('appends the entry of an event the policy keeps, stamped with the clock', () => {
    const entries = fakeRepository();

    new AuditTrailRecorder({ entries, clock }).record(
      ev('kept', { tenantId: 'default', actorId: 'parent-1' }),
      SOURCE,
    );

    expect(entries.calls.appended).toEqual([
      expect.objectContaining({
        tenantId: 'default',
        source: 'auth',
        type: 'kept',
        actor: { kind: 'member', id: 'parent-1' },
        occurredAt: NOW,
      }),
    ]);
  });

  it('writes nothing for an event the policy keeps in the logs only', () => {
    const entries = fakeRepository();

    new AuditTrailRecorder({ entries, clock }).record(
      ev('logged_only', { tenantId: 'default' }),
      SOURCE,
    );

    expect(entries.calls.appended).toEqual([]);
  });

  it('writes nothing for an event that names no tenant', () => {
    const entries = fakeRepository();

    new AuditTrailRecorder({ entries, clock }).record(ev('kept', { actorId: 'parent-1' }), SOURCE);

    expect(entries.calls.appended).toEqual([]);
  });

  it('does not throw into the caller when the store fails: auditing is never why a request fails', () => {
    const entries = fakeRepository({ failWith: STORE_DOWN });
    const recorder = new AuditTrailRecorder({ entries, clock });

    expect(() => {
      recorder.record(ev('kept', { tenantId: 'default', actorId: 'parent-1' }), SOURCE);
    }).not.toThrow();
    // The store was asked, so the failure is the store's to report (it logs its own failure once).
    expect(entries.calls.appended).toHaveLength(1);
  });

  it('leaves no unhandled rejection behind when the store fails', async () => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', onRejection);
    try {
      new AuditTrailRecorder({ entries: fakeRepository({ failWith: STORE_DOWN }), clock }).record(
        ev('kept', { tenantId: 'default', actorId: 'parent-1' }),
        SOURCE,
      );
      // Let every promise the recorder started settle, and Node report any it left unhandled.
      await new Promise((resolve) => setTimeout(resolve, 10));
    } finally {
      process.off('unhandledRejection', onRejection);
    }

    expect(rejections).toEqual([]);
  });

  it('keeps recording after a failure', () => {
    const failing = fakeRepository({ failWith: STORE_DOWN });
    const working = fakeRepository();
    const event = ev('kept', { tenantId: 'default', actorId: 'parent-1' });

    new AuditTrailRecorder({ entries: failing, clock }).record(event, SOURCE);
    new AuditTrailRecorder({ entries: working, clock }).record(event, SOURCE);

    expect(working.calls.appended).toHaveLength(1);
  });
});
