import { describe, expect, it } from 'vitest';

import { GetOnboardingState } from '@modules/learner/application/queries/get-onboarding-state';
import { GUARDIAN_CONSENT_VERSION } from '@modules/learner/domain/models/parent-controls';

import { MAX, PARENT_A, PARENT_B, build, profileOf } from '../fakes';

const FINISHED_AT = new Date('2026-10-02T00:00:00.000Z');

describe('GetOnboardingState', () => {
  it('starts at the child step when the parent has no profile', async () => {
    const { deps } = build(PARENT_A);

    const state = (await new GetOnboardingState(deps).execute())._unsafeUnwrap();

    expect(state).toEqual({ step: 'child', profile: null });
  });

  it('reports the stored step while the profile is unfinished', async () => {
    const { deps } = build(PARENT_A, profileOf({ id: 'p', setupStep: 'controls', tutorId: MAX }));

    const state = (await new GetOnboardingState(deps).execute())._unsafeUnwrap();

    expect(state).toEqual({
      step: 'controls',
      profile: {
        id: 'p',
        displayName: 'Lisa',
        federalState: 'BY',
        grade: 2,
        interests: [],
        tutorId: 'max',
        controls: {
          voiceEnabled: false,
          dailyLimitMinutes: null,
          allowedWindow: null,
          learningInsights: false,
        },
        guardianConfirmed: false,
        voiceConsent: false,
        setupStep: 'controls',
        setupCompletedAt: null,
      },
    });
  });

  it('shows the guardian confirmation only for the current statement version', async () => {
    const confirmedAt = new Date('2026-10-20T08:00:00.000Z');
    const current = profileOf({
      id: 'p',
      guardian: { confirmedAt, consentVersion: GUARDIAN_CONSENT_VERSION },
    });
    const stale = profileOf({ id: 'q', guardian: { confirmedAt, consentVersion: '2000-01-01' } });

    const currentState = await new GetOnboardingState(build(PARENT_A, current).deps).execute();
    const staleState = await new GetOnboardingState(build(PARENT_A, stale).deps).execute();

    expect(currentState._unsafeUnwrap().profile?.guardianConfirmed).toBe(true);
    expect(staleState._unsafeUnwrap().profile?.guardianConfirmed).toBe(false);
  });

  it('is done for a finished profile and exposes neither tenant nor owner', async () => {
    const { deps } = build(PARENT_A, profileOf({ id: 'p', setupCompletedAt: FINISHED_AT }));

    const state = (await new GetOnboardingState(deps).execute())._unsafeUnwrap();

    expect(state.step).toBe('done');
    expect(Object.keys(state.profile ?? {}).sort()).toEqual([
      'controls',
      'displayName',
      'federalState',
      'grade',
      'guardianConfirmed',
      'id',
      'interests',
      'setupCompletedAt',
      'setupStep',
      'tutorId',
      'voiceConsent',
    ]);
  });

  it('prefers the unfinished profile, else the oldest finished one', async () => {
    const older = profileOf({ id: 'old', setupCompletedAt: FINISHED_AT });
    const newer = profileOf({ id: 'new', setupCompletedAt: FINISHED_AT });
    const open = profileOf({ id: 'open' });

    const both = build(PARENT_A, older, open, newer);
    const finishedOnly = build(PARENT_A, older, newer);

    expect((await new GetOnboardingState(both.deps).execute())._unsafeUnwrap().profile?.id).toBe(
      'open',
    );
    expect(
      (await new GetOnboardingState(finishedOnly.deps).execute())._unsafeUnwrap().profile?.id,
    ).toBe('old');
  });

  it('looks only at the caller’s own profiles', async () => {
    const theirs = profileOf({ id: 'theirs', ownerId: PARENT_B.id, setupCompletedAt: FINISHED_AT });
    const { deps } = build(PARENT_A, theirs);

    const state = (await new GetOnboardingState(deps).execute())._unsafeUnwrap();

    expect(state).toEqual({ step: 'child', profile: null });
  });

  it('refuses an actor without the permission', async () => {
    const { deps, securityAudit } = build({ ...PARENT_A, roles: [] });

    const result = await new GetOnboardingState(deps).execute();

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'auth.permission_denied' });
    expect(securityAudit.events).toHaveLength(1);
  });
});
