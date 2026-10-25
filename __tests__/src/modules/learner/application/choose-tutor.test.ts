import { describe, expect, it } from 'vitest';

import { ChooseTutor } from '@modules/learner/application/commands/choose-tutor';

import { okAsync } from '@lib/result';

import { PARENT_A, PARENT_B, build, profileOf } from '../fakes';

const OWN = profileOf({ id: 'own', setupStep: 'tutor' });

describe('ChooseTutor', () => {
  it('stores a selectable tutor, advances to the controls step and audits the tutor id', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, OWN);

    const view = (
      await new ChooseTutor(deps).execute({ profileId: 'own', tutorId: 'lili' })
    )._unsafeUnwrap();

    expect(view).toMatchObject({ tutorId: 'lili', setupStep: 'controls' });
    expect(childProfiles.rows[0]?.tutorId).toBe('lili');
    expect(audit.events).toEqual([
      {
        type: 'learner.tutor_chosen',
        actorId: PARENT_A.id,
        tenantId: PARENT_A.tenantId,
        childProfileId: 'own',
        tutorId: 'lili',
      },
    ]);
  });

  it('is idempotent: the same tutor again is allowed and audited once', async () => {
    const { deps, audit } = build(PARENT_A, OWN);
    const choose = new ChooseTutor(deps);

    await choose.execute({ profileId: 'own', tutorId: 'max' });
    const again = await choose.execute({ profileId: 'own', tutorId: 'max' });

    expect(again.isOk()).toBe(true);
    expect(audit.events).toHaveLength(1);
  });

  it('audits a changed choice again', async () => {
    const { deps, audit } = build(PARENT_A, OWN);
    const choose = new ChooseTutor(deps);

    await choose.execute({ profileId: 'own', tutorId: 'max' });
    await choose.execute({ profileId: 'own', tutorId: 'fina' });

    expect(audit.events.map((event) => ('tutorId' in event ? event.tutorId : null))).toEqual([
      'max',
      'fina',
    ]);
  });

  it('never moves the step back when an earlier step is edited', async () => {
    const reached = profileOf({ id: 'own', setupStep: 'review' });
    const { deps } = build(PARENT_A, reached);

    const view = (
      await new ChooseTutor(deps).execute({ profileId: 'own', tutorId: 'max' })
    )._unsafeUnwrap();

    expect(view.setupStep).toBe('review');
  });

  it.each(['unknown', 'draft-tutor', '', ' max', 'MAX'])(
    'asks the catalog and refuses %j as a field error on tutorId, storing nothing',
    async (tutorId) => {
      const { deps, childProfiles, audit } = build(PARENT_A, OWN);

      const result = await new ChooseTutor(deps).execute({ profileId: 'own', tutorId });

      expect(result._unsafeUnwrapErr()).toMatchObject({
        kind: 'validation',
        fieldErrors: { tutorId: ['learner.validation.tutor_invalid'] },
      });
      expect(childProfiles.writes).toBe(0);
      expect(audit.events).toEqual([]);
    },
  );

  it('answers another parent’s profile exactly like an unknown id, and writes nothing', async () => {
    const theirs = profileOf({ id: 'theirs', ownerId: PARENT_B.id });
    const { deps, childProfiles, audit } = build(PARENT_A, theirs);
    const choose = new ChooseTutor(deps);

    const foreign = await choose.execute({ profileId: 'theirs', tutorId: 'max' });
    const unknown = await choose.execute({ profileId: 'nobody', tutorId: 'max' });

    expect(foreign._unsafeUnwrapErr()).toEqual(unknown._unsafeUnwrapErr());
    expect(foreign._unsafeUnwrapErr()).toMatchObject({ code: 'learner.not_found' });
    expect(childProfiles.writes).toBe(0);
    expect(audit.events).toEqual([]);
  });

  it('answers learner.already_onboarded for a finished profile and writes nothing', async () => {
    const finished = profileOf({ id: 'own', setupCompletedAt: new Date('2026-10-02T00:00:00Z') });
    const { deps, childProfiles } = build(PARENT_A, finished);

    const result = await new ChooseTutor(deps).execute({ profileId: 'own', tutorId: 'max' });

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'learner.already_onboarded' });
    expect(childProfiles.writes).toBe(0);
  });

  it('answers learner.already_onboarded when the profile was finished before the write', async () => {
    const { deps, childProfiles } = build(PARENT_A, OWN);
    childProfiles.updateUnfinished = () => okAsync(null);

    const result = await new ChooseTutor(deps).execute({ profileId: 'own', tutorId: 'max' });

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'learner.already_onboarded' });
  });

  it('refuses an actor without the permission before any lookup', async () => {
    const { deps, childProfiles, securityAudit } = build({ ...PARENT_A, roles: [] }, OWN);

    const result = await new ChooseTutor(deps).execute({ profileId: 'own', tutorId: 'max' });

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'auth.permission_denied' });
    expect(childProfiles.writes).toBe(0);
    expect(securityAudit.events).toHaveLength(1);
  });
});
