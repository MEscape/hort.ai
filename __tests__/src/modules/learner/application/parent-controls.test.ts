import { describe, expect, it } from 'vitest';

import { UpdateParentControls } from '@modules/learner/application/commands/update-parent-controls';
import {
  PARENT_EVIDENCE_LIMIT,
  PARENT_RECORD_LIMIT,
} from '@modules/learner/application/learner-limits';
import { GetParentLearning } from '@modules/learner/application/queries/get-parent-learning';
import { parentPeriod } from '@modules/learner/domain/models/parent-period';
import type {
  ParentLearningRepository,
  ParentLearningScope,
} from '@modules/learner/domain/ports/parent-learning.repository';

import { forbiddenError, infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { build, PARENT_A, PARENT_B, setupDoneProfile } from '../fakes';

const input = {
  profileId: 'own',
  dailyLimitMinutes: 30,
  allowedWindow: { fromMinute: 900, untilMinute: 1080 },
  learningInsights: true,
};

describe('parent settings after initialization', () => {
  it('persists controls without changing companion, interests or voice consent', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, setupDoneProfile());
    const result = await new UpdateParentControls(deps).execute(input);
    expect(result.isOk()).toBe(true);
    expect(childProfiles.rows[0]).toMatchObject({
      tutorId: 'max',
      interests: ['nature'],
      setupStep: 'done',
      controls: { dailyLimitMinutes: 30, learningInsights: true, voiceEnabled: false },
    });
    expect(audit.events).toContainEqual(
      expect.objectContaining({ type: 'learner.controls_changed', dailyLimitChanged: true }),
    );
  });
  it('refuses another parent’s child before writing', async () => {
    const { deps, childProfiles } = build(PARENT_B, setupDoneProfile());
    expect((await new UpdateParentControls(deps).execute(input)).isErr()).toBe(true);
    expect(childProfiles.writes).toBe(0);
  });
  it('rejects a reversed window without changing persisted values', async () => {
    const { deps, childProfiles } = build(PARENT_A, setupDoneProfile());
    const result = await new UpdateParentControls(deps).execute({
      ...input,
      allowedWindow: { fromMinute: 1080, untilMinute: 900 },
    });
    expect(result.isErr() && result.error.kind).toBe('validation');
    expect(childProfiles.writes).toBe(0);
  });
  it('propagates a persistence failure without reporting success', async () => {
    const { deps, childProfiles } = build(PARENT_A, setupDoneProfile());
    childProfiles.updateParentControls = () =>
      errAsync(infrastructureError('learner.persistence_failed', 'Unavailable'));
    const result = await new UpdateParentControls(deps).execute(input);
    expect(result.isErr() && result.error.kind).toBe('infrastructure');
    expect(childProfiles.writes).toBe(0);
  });
});

describe('parent learning read boundary', () => {
  function reader() {
    const scopes: ParentLearningScope[] = [];
    const learning: ParentLearningRepository = {
      list: (scope) => {
        scopes.push(scope);
        return okAsync({
          tasks: [],
          assignments: [],
          tasksTruncated: false,
          assignmentsTruncated: false,
        });
      },
      findTask: () => okAsync(null),
    };
    return { learning, scopes };
  }
  it('does not read any learning records without verified parent access', async () => {
    const { deps } = build(PARENT_A, setupDoneProfile());
    const { learning, scopes } = reader();
    const authorization = {
      ...deps.authorization,
      requireInTenant: () =>
        errAsync(forbiddenError('auth.reauthentication_required', 'Verify access')),
    };
    expect(
      (
        await new GetParentLearning({ ...deps, authorization, learning }).execute({
          profileId: 'own',
          range: 'week',
        })
      ).isErr(),
    ).toBe(true);
    expect(scopes).toEqual([]);
  });
  it('passes the stored consent and server-owned scope to the read model', async () => {
    const { deps } = build(PARENT_A, setupDoneProfile());
    const { learning, scopes } = reader();
    expect(
      (
        await new GetParentLearning({ ...deps, learning }).execute({
          profileId: 'own',
          range: 'today',
        })
      ).isOk(),
    ).toBe(true);
    expect(scopes).toEqual([
      {
        ownerId: 'parent-1',
        tenantId: 'default',
        childProfileId: 'own',
        includeInsights: false,
        recordLimit: PARENT_RECORD_LIMIT,
        evidenceLimit: PARENT_EVIDENCE_LIMIT,
      },
    ]);
  });
});

describe('Berlin date ranges', () => {
  it('starts today at Berlin midnight before the autumn clock change', () => {
    expect(parentPeriod('today', new Date('2026-10-25T12:00:00Z')).from).toBe(
      '2026-10-24T22:00:00Z',
    );
  });
  it('starts the week on Monday with no fixed-hour subtraction', () => {
    const result = parentPeriod('week', new Date('2026-03-29T12:00:00Z'));
    expect(result.from).toBe('2026-03-22T23:00:00Z');
    expect(result.days).toHaveLength(7);
  });
  it('includes exactly thirty calendar dates for the longer period', () => {
    expect(parentPeriod('month', new Date('2026-10-25T12:00:00Z')).days).toHaveLength(30);
  });
});
