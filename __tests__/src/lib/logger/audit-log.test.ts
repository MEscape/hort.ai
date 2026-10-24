import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuditLog } from '@lib/logger';
import type { AuditLevel } from '@lib/logger';
import { auditLevelOf } from '@lib/logger/audit-log';

type AuditEventName = 'created' | 'test_failed';

const levels: Record<AuditEventName, AuditLevel> = { created: 'info', test_failed: 'warn' };

interface Line {
  level: string;
  message: string;
  context: Record<string, unknown>;
}

let stdout: ReturnType<typeof vi.spyOn>;

function written(): Line[] {
  return (stdout.mock.calls as unknown[][]).map((call) => JSON.parse(String(call[0])) as Line);
}

/** An event with extra members, as a module's own event types have. */
function event(extra: Record<string, unknown> = {}, type: AuditEventName = 'created') {
  return { type, ...extra };
}

beforeEach(() => {
  stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('auditLevelOf', () => {
  it('uses the level of the event type', () => {
    expect(auditLevelOf(levels, event())).toBe('info');
    expect(auditLevelOf(levels, event({}, 'test_failed'))).toBe('warn');
  });

  it('raises an event that names an error code to warn', () => {
    expect(auditLevelOf(levels, event({ errorCode: 'connection.refused' }))).toBe('warn');
  });

  it.each(['', undefined, 5, null])('ignores the error code %j', (errorCode) => {
    expect(auditLevelOf(levels, event({ errorCode }))).toBe('info');
  });
});

describe('createAuditLog', () => {
  it('writes one line per event under the module, with the rest of the event as context', () => {
    createAuditLog('profile.audit', levels).record(event({ profileId: 'p1' }));

    expect(written()).toEqual([
      {
        level: 'info',
        message: 'created',
        timestamp: expect.any(String) as string,
        context: { module: 'profile.audit', profileId: 'p1' },
      },
    ]);
  });

  it('logs at the level chosen for the type, raised by an error code', () => {
    const audit = createAuditLog('m', levels);

    audit.record(event({}, 'test_failed'));
    audit.record(event({ errorCode: 'x' }));

    expect(written().map((line) => line.level)).toEqual(['warn', 'warn']);
  });

  it('redacts secrets carried by an event', () => {
    createAuditLog('m', levels).record(event({ apiKey: 'k' }));

    expect(written()[0]?.context).toMatchObject({ apiKey: '[REDACTED]' });
  });

  it('never throws into the request it describes', () => {
    stdout.mockImplementation(() => {
      throw new Error('sink down');
    });

    expect(() => {
      createAuditLog('m', levels).record(event());
    }).not.toThrow();
  });
});
