import { describe, expect, it } from 'vitest';

import { TEACHER_ROLE } from '@modules/auth/domain/models/role';
import { AdoptClassroomSettings } from '@modules/learner/application/commands/adopt-classroom-settings';
import { GetChildProfileById } from '@modules/learner/application/queries/get-child-profile-by-id';

import { PARENT_A, PARENT_B, build, profileOf } from '../fakes';

const FINISHED = profileOf({ id: 'own', setupStep: 'done', setupCompletedAt: new Date(0) });

describe('learner use cases the classroom module relies on (#32)', () => {
  it("reads the parent's own child and refuses anyone else's", async () => {
    const own = build(PARENT_A, FINISHED);
    expect((await new GetChildProfileById(own.deps).execute('own'))._unsafeUnwrap().id).toBe('own');

    const other = build(PARENT_B, FINISHED);
    const foreign = await new GetChildProfileById(other.deps).execute('own');
    expect(foreign._unsafeUnwrapErr().code).toBe('learner.not_found');

    const teacher = build({ ...PARENT_A, roles: [TEACHER_ROLE] }, FINISHED);
    const refused = await new GetChildProfileById(teacher.deps).execute('own');
    expect(refused._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });

  it('takes over the class state and grade on a finished profile and audits only ids', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, FINISHED);

    const result = await new AdoptClassroomSettings(deps).execute({
      profileId: 'own',
      federalState: 'HE',
      grade: 4,
    });

    expect(result._unsafeUnwrap()).toMatchObject({
      federalState: 'HE',
      grade: 4,
      setupStep: 'done',
    });
    expect(childProfiles.rows[0]).toMatchObject({ federalState: 'HE', grade: 4 });
    expect(audit.events).toEqual([
      {
        type: 'learner.classroom_settings_adopted',
        actorId: PARENT_A.id,
        tenantId: PARENT_A.tenantId,
        childProfileId: 'own',
      },
    ]);
  });

  it('refuses values outside the learner vocabulary and another parent, changing nothing', async () => {
    const { deps, childProfiles } = build(PARENT_A, FINISHED);
    const invalid = await new AdoptClassroomSettings(deps).execute({
      profileId: 'own',
      federalState: 'he',
      grade: 7,
    });
    expect(invalid._unsafeUnwrapErr()).toMatchObject({
      kind: 'validation',
      fieldErrors: {
        federalState: ['learner.validation.federal_state_invalid'],
        grade: ['learner.validation.grade_invalid'],
      },
    });

    const other = build(PARENT_B, FINISHED);
    const foreign = await new AdoptClassroomSettings(other.deps).execute({
      profileId: 'own',
      federalState: 'HE',
      grade: 3,
    });
    expect(foreign.isErr()).toBe(true);
    expect(childProfiles.writes).toBe(0);
    expect(other.childProfiles.writes).toBe(0);
  });
});
