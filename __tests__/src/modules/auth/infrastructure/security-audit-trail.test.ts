import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NewAuditEntry } from '@modules/audit/domain/models/audit-entry';
import { toActorId } from '@modules/auth/domain/models/ids';
import type { SecurityEvent } from '@modules/auth/domain/ports/security-audit-log.port';

import { TENANT } from '../fakes';

/**
 * The auth module's audit port wired exactly as its composition root wires it: the module's own
 * log line, plus the durable trail of the audit module, with the Prisma store replaced by one
 * the test controls. Everything in between (`withAuditTrail`, the recorder, the module's level and
 * trail tables) is the real code.
 */
const store = vi.hoisted(() => ({
  appended: [] as unknown[],
  fail: false,
}));

vi.mock('@modules/audit/infrastructure/prisma/prisma-audit-trail.repository', async () => {
  const { errAsync: failed, okAsync: succeeded } = await import('@lib/result');
  const { infrastructureError: broken } = await import('@lib/errors');
  return {
    PrismaAuditTrailRepository: class {
      append(entry: unknown) {
        if (store.fail) {
          return failed(broken('audit.persistence_failed', 'The trail could not be written.'));
        }
        store.appended.push(entry);
        return succeeded(undefined);
      }
    },
  };
});

const { withAuditTrail } = await import('@modules/audit');
const { LEVEL_BY_EVENT, TRAIL_BY_EVENT, loggerSecurityAuditLog } =
  await import('@modules/auth/infrastructure/audit/logger-security-audit-log');

const audit = withAuditTrail(loggerSecurityAuditLog, {
  source: 'auth',
  levels: LEVEL_BY_EVENT,
  policy: TRAIL_BY_EVENT,
});

const ACTOR = toActorId('parent-1');

const EVENTS = [
  [
    'authorization.denied',
    {
      type: 'authorization.denied',
      actorId: ACTOR,
      tenantId: TENANT,
      permission: 'learner.read',
      reason: 'owner_mismatch',
    },
  ],
  [
    'authentication.session_created',
    { type: 'authentication.session_created', actorId: ACTOR, tenantId: TENANT },
  ],
  [
    'authentication.session_revoked',
    { type: 'authentication.session_revoked', actorId: ACTOR, tenantId: TENANT },
  ],
  [
    'authentication.account_created',
    { type: 'authentication.account_created', actorId: ACTOR, tenantId: TENANT },
  ],
  [
    'authentication.password_reset_completed',
    { type: 'authentication.password_reset_completed', actorId: ACTOR, tenantId: TENANT },
  ],
  [
    'authentication.sign_in_failed',
    {
      type: 'authentication.sign_in_failed',
      tenantId: TENANT,
      errorCode: 'auth.invalid_credentials',
    },
  ],
  [
    'authorization.admin_override',
    {
      type: 'authorization.admin_override',
      actorId: ACTOR,
      tenantId: TENANT,
      permission: 'learner.read',
      ownerId: toActorId('parent-2'),
    },
  ],
  [
    'authentication.parent_area_opened',
    { type: 'authentication.parent_area_opened', actorId: ACTOR, tenantId: TENANT },
  ],
  [
    'authentication.parent_area_open_failed',
    {
      type: 'authentication.parent_area_open_failed',
      actorId: ACTOR,
      tenantId: TENANT,
      errorCode: 'auth.invalid_credentials',
    },
  ],
] as const satisfies ReadonlyArray<readonly [SecurityEvent['type'], SecurityEvent]>;

let stdout: ReturnType<typeof vi.spyOn>;

const lines = () =>
  (stdout.mock.calls as unknown[][]).map(
    (call) => JSON.parse(String(call[0])) as { level: string; message: string },
  );

beforeEach(() => {
  store.appended.length = 0;
  store.fail = false;
  stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('security events and the audit trail', () => {
  it('has a trail decision and a log level for every event type', () => {
    expect(Object.keys(TRAIL_BY_EVENT).sort()).toEqual(EVENTS.map(([type]) => type).sort());
    expect(Object.keys(LEVEL_BY_EVENT).sort()).toEqual(EVENTS.map(([type]) => type).sort());
  });

  it.each(EVENTS)(
    'keeps %s in the trail, placed in the default tenant under the auth source',
    (_type, event) => {
      audit.record(event);

      expect(store.appended).toHaveLength(1);
      expect(store.appended[0]).toMatchObject({
        tenantId: 'default',
        source: 'auth',
        type: event.type,
      });
    },
  );

  it('attributes an event to the parent it names, and a failed sign-in to a visitor', () => {
    audit.record(EVENTS[1][1]);
    audit.record(EVENTS[5][1]);

    const [member, visitor] = store.appended as NewAuditEntry[];
    expect(member?.actor).toEqual({ kind: 'member', id: 'parent-1' });
    expect(visitor?.actor).toEqual({ kind: 'visitor' });
  });

  it('marks refusals and failures as warnings, ordinary lifecycle events as info', () => {
    for (const [, event] of EVENTS) {
      audit.record(event);
    }

    const severities = Object.fromEntries(
      (store.appended as NewAuditEntry[]).map((entry) => [entry.type, entry.severity]),
    );
    expect(severities).toEqual({
      'authorization.denied': 'warn',
      'authorization.admin_override': 'warn',
      'authentication.session_created': 'info',
      'authentication.session_revoked': 'info',
      'authentication.account_created': 'info',
      'authentication.password_reset_completed': 'info',
      'authentication.sign_in_failed': 'warn',
      'authentication.parent_area_opened': 'info',
      'authentication.parent_area_open_failed': 'warn',
    });
  });

  it('records ids, codes and enum values only: no field of an entry can carry a credential', () => {
    for (const [, event] of EVENTS) {
      audit.record(event);
    }

    const detailKeys = new Set(
      (store.appended as NewAuditEntry[]).flatMap((entry) => Object.keys(entry.details)),
    );
    expect([...detailKeys].sort()).toEqual(['errorCode', 'ownerId', 'permission', 'reason']);
  });

  it('writes the log line as well as the trail entry', () => {
    audit.record(EVENTS[0][1]);

    expect(lines()).toEqual([
      expect.objectContaining({ level: 'warn', message: 'authorization.denied' }),
    ]);
  });

  it('records one entry per occurrence: two real denials are two facts, never merged', () => {
    audit.record(EVENTS[0][1]);
    audit.record(EVENTS[0][1]);

    expect(store.appended).toHaveLength(2);
  });
});

describe('when the trail cannot be written', () => {
  it('never throws into the sign-in or authorization that caused the event', () => {
    store.fail = true;

    expect(() => {
      audit.record(EVENTS[0][1]);
    }).not.toThrow();
  });

  it('still writes the log line, so the event is not lost from operations', () => {
    store.fail = true;

    audit.record(EVENTS[0][1]);

    expect(lines()).toEqual([expect.objectContaining({ message: 'authorization.denied' })]);
  });

  it('recovers: the next event is written once the store is back', () => {
    store.fail = true;
    audit.record(EVENTS[0][1]);
    store.fail = false;

    audit.record(EVENTS[1][1]);

    expect(store.appended).toHaveLength(1);
    expect(store.appended[0]).toMatchObject({ type: 'authentication.session_created' });
  });
});
