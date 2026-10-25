import { describe, expect, it } from 'vitest';

import { toAuditEntry } from '@modules/audit/domain/models/audit-trail-source';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import { toChildProfileId } from '@modules/progression/domain/models/ids';
import type { ProgressionEvent } from '@modules/progression/domain/ports/progression-audit-log.port';
import {
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
} from '@modules/progression/infrastructure/audit/logger-progression-audit-log';

import { NOW } from '../fakes';

const IDS = {
  actorId: toActorId('parent-1'),
  tenantId: toTenantId('default'),
  childProfileId: toChildProfileId('child-1'),
};

const EVENTS: ProgressionEvent[] = [
  { type: 'progression.daily_reward_claimed', ...IDS, xp: 5, level: 1 },
  { type: 'progression.xp_awarded', ...IDS, event: 'help_session_completed', xp: 10, level: 2 },
];

const trail = { source: 'progression', levels: LEVEL_BY_EVENT, policy: TRAIL_BY_EVENT } as const;

describe('the progression audit trail', () => {
  it.each(EVENTS)(
    'keeps $type in the trail under the progression source, as the parent’s act',
    (event) => {
      expect(toAuditEntry(event, trail, NOW)).toMatchObject({
        source: 'progression',
        type: event.type,
        severity: 'info',
        tenantId: 'default',
        actor: { kind: 'member', id: 'parent-1' },
      });
    },
  );

  it('holds only ids, counts and codes, never a name or any other detail of the child', () => {
    expect(EVENTS.map((event) => toAuditEntry(event, trail, NOW)?.details)).toEqual([
      { childProfileId: 'child-1', xp: 5, level: 1 },
      { childProfileId: 'child-1', event: 'help_session_completed', xp: 10, level: 2 },
    ]);
  });
});
