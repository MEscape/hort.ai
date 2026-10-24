import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth/domain/models/ids';
import { SaveInterests } from '@modules/learner/application/commands/save-interests';

import { okAsync } from '@lib/result';

import { PARENT_A, PARENT_B, build, profileOf } from '../fakes';

const OWN = profileOf({ id: 'own' });

describe('SaveInterests', () => {
  it('stores the interests, advances to the tutor step and audits only the count', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, OWN);

    const view = (
      await new SaveInterests(deps).execute({ profileId: 'own', interests: ['music', 'animals'] })
    )._unsafeUnwrap();

    expect(view).toMatchObject({ interests: ['animals', 'music'], setupStep: 'tutor' });
    expect(childProfiles.rows[0]).toMatchObject({ interests: ['animals', 'music'] });
    expect(audit.events).toEqual([
      {
        type: 'learner.interests_saved',
        actorId: PARENT_A.id,
        tenantId: PARENT_A.tenantId,
        childProfileId: 'own',
        count: 2,
      },
    ]);
  });

  it('accepts skipping: an empty choice is valid and still advances the step', async () => {
    const { deps, audit } = build(PARENT_A, OWN);

    const view = (
      await new SaveInterests(deps).execute({ profileId: 'own', interests: [] })
    )._unsafeUnwrap();

    expect(view).toMatchObject({ interests: [], setupStep: 'tutor' });
    expect(audit.events).toEqual([]);
  });

  it('is idempotent: the same set again is stored again but audited once', async () => {
    const { deps, audit } = build(PARENT_A, OWN);
    const save = new SaveInterests(deps);

    await save.execute({ profileId: 'own', interests: ['art', 'science'] });
    const again = await save.execute({ profileId: 'own', interests: ['science', 'art'] });

    expect(again.isOk()).toBe(true);
    expect(audit.events).toHaveLength(1);
  });

  it('audits a changed set again', async () => {
    const { deps, audit } = build(PARENT_A, OWN);
    const save = new SaveInterests(deps);

    await save.execute({ profileId: 'own', interests: ['art'] });
    await save.execute({ profileId: 'own', interests: ['art', 'music', 'history'] });

    expect(audit.events.map((event) => ('count' in event ? event.count : null))).toEqual([1, 3]);
  });

  it('never moves the step back when an earlier step is edited', async () => {
    const reached = profileOf({ id: 'own', setupStep: 'review' });
    const { deps, childProfiles } = build(PARENT_A, reached);

    const view = (
      await new SaveInterests(deps).execute({ profileId: 'own', interests: ['nature'] })
    )._unsafeUnwrap();

    expect(view.setupStep).toBe('review');
    expect(childProfiles.rows[0]?.setupStep).toBe('review');
  });

  it.each([
    [['nature', 'nature'], 'learner.validation.interests_invalid'],
    [['football'], 'learner.validation.interests_invalid'],
    [[''], 'learner.validation.interests_invalid'],
    [['nature', 'animals', 'science', 'art', 'music'], 'learner.validation.interests_too_many'],
  ])('refuses %j with %s and stores nothing', async (interests, code) => {
    const { deps, childProfiles, audit } = build(PARENT_A, OWN);

    const result = await new SaveInterests(deps).execute({ profileId: 'own', interests });

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'validation',
      fieldErrors: { interests: [code] },
    });
    expect(childProfiles.writes).toBe(0);
    expect(audit.events).toEqual([]);
  });

  it('answers another parent’s profile exactly like an unknown id, and writes nothing', async () => {
    const theirs = profileOf({ id: 'theirs', ownerId: PARENT_B.id });
    const { deps, childProfiles, audit } = build(PARENT_A, theirs);
    const save = new SaveInterests(deps);

    const foreign = await save.execute({ profileId: 'theirs', interests: ['art'] });
    const unknown = await save.execute({ profileId: 'nobody', interests: ['art'] });

    expect(foreign._unsafeUnwrapErr()).toEqual(unknown._unsafeUnwrapErr());
    expect(foreign._unsafeUnwrapErr()).toMatchObject({ code: 'learner.not_found' });
    expect(childProfiles.writes).toBe(0);
    expect(audit.events).toEqual([]);
  });

  it('does not reach a profile of another tenant', async () => {
    const elsewhere = profileOf({ id: 'own', tenantId: toTenantId('other') });
    const { deps, childProfiles } = build(PARENT_A, elsewhere);

    const result = await new SaveInterests(deps).execute({ profileId: 'own', interests: [] });

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'learner.not_found' });
    expect(childProfiles.writes).toBe(0);
  });

  it('answers learner.already_onboarded for a finished profile and writes nothing', async () => {
    const finished = profileOf({ id: 'own', setupCompletedAt: new Date('2026-10-02T00:00:00Z') });
    const { deps, childProfiles } = build(PARENT_A, finished);

    const result = await new SaveInterests(deps).execute({ profileId: 'own', interests: ['art'] });

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'conflict',
      code: 'learner.already_onboarded',
    });
    expect(childProfiles.writes).toBe(0);
  });

  it('answers learner.already_onboarded when the profile was finished before the write', async () => {
    const { deps, childProfiles } = build(PARENT_A, OWN);
    childProfiles.updateUnfinished = () => okAsync(null);

    const result = await new SaveInterests(deps).execute({ profileId: 'own', interests: ['art'] });

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'learner.already_onboarded' });
  });

  it('refuses an actor without the permission before any lookup', async () => {
    const { deps, childProfiles, securityAudit } = build({ ...PARENT_A, roles: [] }, OWN);

    const result = await new SaveInterests(deps).execute({ profileId: 'own', interests: [] });

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'auth.permission_denied' });
    expect(childProfiles.writes).toBe(0);
    expect(securityAudit.events).toHaveLength(1);
  });
});
