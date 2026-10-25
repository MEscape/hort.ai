import { describe, expect, it } from 'vitest';

import { AdoptSchoolSettings } from '@modules/learner/application/commands/adopt-school-settings';

import { PARENT_A, PARENT_B, build, profileOf } from '../fakes';

const FINISHED = profileOf({
  id: 'own',
  setupStep: 'done',
  setupCompletedAt: new Date('2026-10-02T00:00:00.000Z'),
});

describe('AdoptSchoolSettings', () => {
  it('stores the class’s federal state and grade, also on a finished profile', async () => {
    const { deps, childProfiles } = build(PARENT_A, FINISHED);

    const view = (
      await new AdoptSchoolSettings(deps).execute({
        profileId: 'own',
        federalState: 'HE',
        grade: 3,
      })
    )._unsafeUnwrap();

    expect(view).toMatchObject({ id: 'own', federalState: 'HE', grade: 3, setupStep: 'done' });
    expect(childProfiles.rows[0]).toMatchObject({ federalState: 'HE', grade: 3 });
  });

  it('refuses an unknown federal state or grade and writes nothing', async () => {
    const { deps, childProfiles } = build(PARENT_A, FINISHED);
    const adopt = new AdoptSchoolSettings(deps);

    const state = await adopt.execute({ profileId: 'own', federalState: 'XX', grade: 3 });
    const grade = await adopt.execute({ profileId: 'own', federalState: 'HE', grade: 7 });

    expect(state._unsafeUnwrapErr()).toMatchObject({ kind: 'validation' });
    expect(grade._unsafeUnwrapErr()).toMatchObject({ kind: 'validation' });
    expect(childProfiles.writes).toBe(0);
  });

  it('answers another parent’s profile exactly like an unknown id, and writes nothing', async () => {
    const theirs = profileOf({ id: 'theirs', ownerId: PARENT_B.id });
    const { deps, childProfiles } = build(PARENT_A, theirs);
    const adopt = new AdoptSchoolSettings(deps);

    const foreign = await adopt.execute({ profileId: 'theirs', federalState: 'HE', grade: 3 });
    const unknown = await adopt.execute({ profileId: 'nobody', federalState: 'HE', grade: 3 });

    expect(foreign._unsafeUnwrapErr()).toEqual(unknown._unsafeUnwrapErr());
    expect(foreign._unsafeUnwrapErr()).toMatchObject({ code: 'learner.not_found' });
    expect(childProfiles.writes).toBe(0);
  });
});
