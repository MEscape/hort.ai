import { describe, expect, it } from 'vitest';

import { toAuditEntry } from '@modules/audit/domain/models/audit-trail-source';
import {
  toActorId,
  toChildProfileId,
  toTenantId,
  toTutorId,
} from '@modules/learner/domain/models/ids';
import type { LearnerEvent } from '@modules/learner/domain/ports/learner-audit-log.port';
import {
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
} from '@modules/learner/infrastructure/audit/logger-learner-audit-log';

import { NOW } from '../fakes';

const IDS = {
  actorId: toActorId('parent-1'),
  tenantId: toTenantId('default'),
  childProfileId: toChildProfileId('profile-1'),
};

const EVENTS: LearnerEvent[] = [
  { type: 'learner.profile_created', ...IDS },
  { type: 'learner.interests_saved', ...IDS, count: 2 },
  { type: 'learner.tutor_chosen', ...IDS, tutorId: toTutorId('max') },
  {
    type: 'learner.controls_changed',
    ...IDS,
    voiceEnabled: true,
    learningInsights: null,
    dailyLimitChanged: true,
    allowedWindowChanged: false,
  },
  { type: 'learner.guardian_consent_recorded', ...IDS, consentVersion: '2026-10-24' },
  {
    type: 'learner.onboarding_reset',
    actorId: IDS.actorId,
    tenantId: IDS.tenantId,
    deletedCount: 2,
  },
  { type: 'learner.setup_completed', ...IDS },
];

describe('the learner audit trail', () => {
  it.each(EVENTS)(
    'keeps $type in the trail under the learner source, as the parent’s act',
    (event) => {
      const entry = toAuditEntry(
        event,
        { source: 'learner', levels: LEVEL_BY_EVENT, policy: TRAIL_BY_EVENT },
        NOW,
      );

      expect(entry).toMatchObject({
        source: 'learner',
        type: event.type,
        severity: 'info',
        tenantId: 'default',
        actor: { kind: 'member', id: 'parent-1' },
      });
    },
  );

  it('holds only ids, counts and flags, never a name or any other detail of the child', () => {
    const details = EVENTS.map(
      (event) =>
        toAuditEntry(
          event,
          { source: 'learner', levels: LEVEL_BY_EVENT, policy: TRAIL_BY_EVENT },
          NOW,
        )?.details,
    );

    expect(details).toEqual([
      { childProfileId: 'profile-1' },
      { childProfileId: 'profile-1', count: 2 },
      { childProfileId: 'profile-1', tutorId: 'max' },
      {
        childProfileId: 'profile-1',
        voiceEnabled: true,
        learningInsights: null,
        dailyLimitChanged: true,
        allowedWindowChanged: false,
      },
      { childProfileId: 'profile-1', consentVersion: '2026-10-24' },
      { deletedCount: 2 },
      { childProfileId: 'profile-1' },
    ]);
  });
});
