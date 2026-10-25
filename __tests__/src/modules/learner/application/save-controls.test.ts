import { describe, expect, it } from 'vitest';

import { SaveControls } from '@modules/learner/application/commands/save-controls';
import type { SaveControlsInput } from '@modules/learner/application/contracts/learner-inputs';
import {
  GUARDIAN_CONSENT_VERSION,
  VOICE_NOTICE_VERSION,
} from '@modules/learner/domain/models/parent-controls';

import { okAsync } from '@lib/result';

import { NOW, PARENT_A, PARENT_B, build, profileOf } from '../fakes';

const OWN = profileOf({ id: 'own', setupStep: 'controls' });

const INPUT: SaveControlsInput = {
  profileId: 'own',
  voiceEnabled: true,
  voiceNoticeVersion: VOICE_NOTICE_VERSION,
  dailyLimitMinutes: 45,
  allowedWindow: { fromMinute: 900, untilMinute: 1140 },
  learningInsights: true,
  guardianConfirmed: true,
};

const IDS = { actorId: PARENT_A.id, tenantId: PARENT_A.tenantId, childProfileId: 'own' };

describe('SaveControls', () => {
  it('stores the controls and the confirmation, advances to the review step and audits both', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, OWN);

    const view = (await new SaveControls(deps).execute(INPUT))._unsafeUnwrap();

    expect(view).toMatchObject({
      controls: {
        voiceEnabled: true,
        dailyLimitMinutes: 45,
        allowedWindow: { fromMinute: 900, untilMinute: 1140 },
        learningInsights: true,
      },
      guardianConfirmed: true,
      setupStep: 'review',
    });
    expect(childProfiles.rows[0]?.guardian).toEqual({
      confirmedAt: NOW,
      consentVersion: GUARDIAN_CONSENT_VERSION,
    });
    expect(audit.events).toEqual([
      {
        type: 'learner.controls_changed',
        ...IDS,
        voiceEnabled: true,
        learningInsights: true,
        dailyLimitChanged: true,
        allowedWindowChanged: true,
      },
      { type: 'learner.guardian_consent_recorded', ...IDS, consentVersion: '2026-10-24' },
      {
        type: 'learner.voice_consent_changed',
        ...IDS,
        allowed: true,
        noticeVersion: VOICE_NOTICE_VERSION,
      },
    ]);
  });

  it('gives a current voice consent when the parent allows voice, so speech input works at once', async () => {
    const { deps, childProfiles } = build(PARENT_A, OWN);

    const view = (await new SaveControls(deps).execute(INPUT))._unsafeUnwrap();

    expect(view.voiceConsent).toBe(true);
    expect(childProfiles.rows[0]?.voiceNotice).toEqual({
      confirmedAt: NOW,
      version: VOICE_NOTICE_VERSION,
    });
  });

  it('gives no voice consent with voice off, and clears an earlier one', async () => {
    const { deps, childProfiles } = build(PARENT_A, OWN);
    const save = new SaveControls(deps);
    await save.execute(INPUT);

    const view = (
      await save.execute({ ...INPUT, voiceEnabled: false, voiceNoticeVersion: null })
    )._unsafeUnwrap();

    expect(view.voiceConsent).toBe(false);
    expect(childProfiles.rows[0]?.voiceNotice).toBeNull();
  });

  it.each([null, '2000-01-01'])(
    'refuses voice on without the current notice (%s) and stores nothing',
    async (voiceNoticeVersion) => {
      const { deps, childProfiles, audit } = build(PARENT_A, OWN);

      const result = await new SaveControls(deps).execute({ ...INPUT, voiceNoticeVersion });

      expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'learner.voice_notice_outdated' });
      expect(childProfiles.writes).toBe(0);
      expect(audit.events).toEqual([]);
    },
  );

  it('accepts the restrictive defaults and then audits only the confirmation', async () => {
    const { deps, audit } = build(PARENT_A, OWN);

    const view = (
      await new SaveControls(deps).execute({
        ...INPUT,
        voiceEnabled: false,
        dailyLimitMinutes: null,
        allowedWindow: null,
        learningInsights: false,
      })
    )._unsafeUnwrap();

    expect(view.controls).toEqual({
      voiceEnabled: false,
      dailyLimitMinutes: null,
      allowedWindow: null,
      learningInsights: false,
    });
    expect(audit.events.map((event) => event.type)).toEqual(['learner.guardian_consent_recorded']);
  });

  it('on a re-save keeps the first confirmation time and audits only what changed', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, OWN);
    const save = new SaveControls(deps);
    await save.execute(INPUT);
    const first = childProfiles.rows[0]?.guardian;
    audit.events.length = 0;

    await save.execute({ ...INPUT, voiceEnabled: false, dailyLimitMinutes: 60 });

    expect(childProfiles.rows[0]?.guardian).toBe(first);
    expect(audit.events).toEqual([
      {
        type: 'learner.controls_changed',
        ...IDS,
        voiceEnabled: false,
        learningInsights: null,
        dailyLimitChanged: true,
        allowedWindowChanged: false,
      },
      { type: 'learner.voice_consent_changed', ...IDS, allowed: false, noticeVersion: null },
    ]);
  });

  it('writes the same controls again without any audit event', async () => {
    const { deps, audit } = build(PARENT_A, OWN);
    const save = new SaveControls(deps);
    await save.execute(INPUT);
    audit.events.length = 0;

    const again = await save.execute(INPUT);

    expect(again.isOk()).toBe(true);
    expect(audit.events).toEqual([]);
  });

  it('records a new confirmation when the stored one was for an older statement version', async () => {
    const outdated = profileOf({
      id: 'own',
      setupStep: 'controls',
      guardian: { confirmedAt: new Date('2025-01-01T00:00:00Z'), consentVersion: '2000-01-01' },
    });
    const { deps, childProfiles, audit } = build(PARENT_A, outdated);

    await new SaveControls(deps).execute(INPUT);

    expect(childProfiles.rows[0]?.guardian).toEqual({
      confirmedAt: NOW,
      consentVersion: GUARDIAN_CONSENT_VERSION,
    });
    expect(audit.events.map((event) => event.type)).toContain('learner.guardian_consent_recorded');
  });

  it('never moves the step back when an earlier step is edited', async () => {
    const reached = profileOf({ id: 'own', setupStep: 'review' });
    const { deps } = build(PARENT_A, reached);

    const view = (await new SaveControls(deps).execute(INPUT))._unsafeUnwrap();

    expect(view.setupStep).toBe('review');
  });

  it.each([false, undefined])(
    'requires the guardian confirmation (%s) and stores nothing',
    async (guardianConfirmed) => {
      const { deps, childProfiles, audit } = build(PARENT_A, OWN);

      const result = await new SaveControls(deps).execute({
        ...INPUT,
        guardianConfirmed: guardianConfirmed!,
      });

      expect(result._unsafeUnwrapErr()).toMatchObject({
        kind: 'validation',
        fieldErrors: { guardianConfirmed: ['learner.validation.guardian_confirmation_required'] },
      });
      expect(childProfiles.writes).toBe(0);
      expect(audit.events).toEqual([]);
    },
  );

  it('reports every invalid control at once and stores nothing', async () => {
    const { deps, childProfiles } = build(PARENT_A, OWN);

    const result = await new SaveControls(deps).execute({
      ...INPUT,
      dailyLimitMinutes: 20,
      allowedWindow: { fromMinute: 600, untilMinute: 610 },
      guardianConfirmed: false,
    });

    const error = result._unsafeUnwrapErr();
    expect('fieldErrors' in error && Object.keys(error.fieldErrors).sort()).toEqual([
      'allowedWindow',
      'dailyLimitMinutes',
      'guardianConfirmed',
    ]);
    expect(childProfiles.writes).toBe(0);
  });

  it('answers another parent’s profile exactly like an unknown id, and writes nothing', async () => {
    const theirs = profileOf({ id: 'theirs', ownerId: PARENT_B.id });
    const { deps, childProfiles, audit } = build(PARENT_A, theirs);
    const save = new SaveControls(deps);

    const foreign = await save.execute({ ...INPUT, profileId: 'theirs' });
    const unknown = await save.execute({ ...INPUT, profileId: 'nobody' });

    expect(foreign._unsafeUnwrapErr()).toEqual(unknown._unsafeUnwrapErr());
    expect(foreign._unsafeUnwrapErr()).toMatchObject({ code: 'learner.not_found' });
    expect(childProfiles.writes).toBe(0);
    expect(audit.events).toEqual([]);
  });

  it('answers learner.already_onboarded for a finished profile and writes nothing', async () => {
    const finished = profileOf({ id: 'own', setupCompletedAt: new Date('2026-10-02T00:00:00Z') });
    const { deps, childProfiles } = build(PARENT_A, finished);

    const result = await new SaveControls(deps).execute(INPUT);

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'learner.already_onboarded' });
    expect(childProfiles.writes).toBe(0);
  });

  it('answers learner.already_onboarded when the profile was finished before the write', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, OWN);
    childProfiles.updateUnfinished = () => okAsync(null);

    const result = await new SaveControls(deps).execute(INPUT);

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'learner.already_onboarded' });
    expect(audit.events).toEqual([]);
  });

  it('records no child detail in any audit event', async () => {
    const { deps, audit } = build(PARENT_A, OWN);

    await new SaveControls(deps).execute(INPUT);

    expect(JSON.stringify(audit.events)).not.toContain('Lisa');
  });

  it('refuses an actor without the permission before any lookup', async () => {
    const { deps, childProfiles, securityAudit } = build({ ...PARENT_A, roles: [] }, OWN);

    const result = await new SaveControls(deps).execute(INPUT);

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'auth.permission_denied' });
    expect(childProfiles.writes).toBe(0);
    expect(securityAudit.events).toHaveLength(1);
  });
});
