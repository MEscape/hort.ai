import { describe, expect, it } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import { CreateChildProfile } from '@modules/learner/application/commands/create-child-profile';

import { DETAILS, MAX, PARENT_A, PARENT_B, build, profileOf } from '../fakes';

const FINISHED = profileOf({ id: 'done', setupCompletedAt: new Date('2026-10-02T00:00:00Z') });

describe('CreateChildProfile', () => {
  it('stores the details as the signed-in parent’s profile and records one creation', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A);

    const result = await new CreateChildProfile(deps).execute({
      ...DETAILS,
      displayName: ' Lisa ',
    });

    expect(result._unsafeUnwrap()).toMatchObject({
      displayName: 'Lisa',
      federalState: 'BY',
      grade: 2,
      interests: [],
      tutorId: null,
      setupStep: 'interests',
      setupCompletedAt: null,
    });
    expect(childProfiles.rows).toHaveLength(1);
    expect(childProfiles.rows[0]).toMatchObject({
      ownerId: PARENT_A.id,
      tenantId: PARENT_A.tenantId,
    });
    expect(audit.events).toEqual([
      {
        type: 'learner.profile_created',
        actorId: PARENT_A.id,
        tenantId: PARENT_A.tenantId,
        childProfileId: childProfiles.rows[0]?.id,
      },
    ]);
  });

  it('is idempotent: a repeated or corrected submit updates the one unfinished profile', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A);
    const create = new CreateChildProfile(deps);

    const first = (await create.execute(DETAILS))._unsafeUnwrap();
    const again = (await create.execute(DETAILS))._unsafeUnwrap();
    const corrected = (
      await create.execute({ displayName: 'Lina', federalState: 'NW', grade: 3 })
    )._unsafeUnwrap();

    expect(childProfiles.rows).toHaveLength(1);
    expect([again.id, corrected.id]).toEqual([first.id, first.id]);
    expect(corrected).toMatchObject({ displayName: 'Lina', federalState: 'NW', grade: 3 });
    expect(audit.events.map((event) => event.type)).toEqual(['learner.profile_created']);
  });

  it('keeps the furthest step when the details are corrected', async () => {
    const reached = profileOf({ id: 'p', setupStep: 'controls', tutorId: MAX });
    const { deps, childProfiles } = build(PARENT_A, reached);

    const view = (
      await new CreateChildProfile(deps).execute({ ...DETAILS, displayName: 'Lina' })
    )._unsafeUnwrap();

    expect(view).toMatchObject({
      id: 'p',
      displayName: 'Lina',
      setupStep: 'controls',
      tutorId: 'max',
    });
    expect(childProfiles.rows).toHaveLength(1);
  });

  it('answers learner.already_onboarded once the parent’s child is set up, and writes nothing', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, FINISHED);

    const result = await new CreateChildProfile(deps).execute(DETAILS);

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'conflict',
      code: 'learner.already_onboarded',
    });
    expect(childProfiles.writes).toBe(0);
    expect(audit.events).toEqual([]);
  });

  it('does not touch another parent’s unfinished profile, it creates the caller’s own', async () => {
    const others = profileOf({ id: 'theirs', ownerId: PARENT_B.id, displayName: 'Max' });
    const { deps, childProfiles } = build(PARENT_A, others);

    const view = (await new CreateChildProfile(deps).execute(DETAILS))._unsafeUnwrap();

    expect(view.id).not.toBe('theirs');
    expect(childProfiles.rows).toHaveLength(2);
    expect(childProfiles.rows.find((row) => row.id === 'theirs')?.displayName).toBe('Max');
  });

  it('is not influenced by a profile of another tenant', async () => {
    const elsewhere = profileOf({
      id: 'elsewhere',
      tenantId: toTenantId('other'),
      ownerId: toActorId('parent-1'),
      setupCompletedAt: new Date('2026-10-02T00:00:00Z'),
    });
    const { deps, childProfiles } = build(PARENT_A, elsewhere);

    const result = await new CreateChildProfile(deps).execute(DETAILS);

    expect(result.isOk()).toBe(true);
    expect(childProfiles.rows).toHaveLength(2);
  });

  it('reports every invalid field and stores nothing', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A);

    const result = await new CreateChildProfile(deps).execute({
      displayName: '',
      federalState: 'XX',
      grade: 7,
    });

    const error = result._unsafeUnwrapErr();
    expect(error.kind).toBe('validation');
    expect('fieldErrors' in error && Object.keys(error.fieldErrors).sort()).toEqual([
      'displayName',
      'federalState',
      'grade',
    ]);
    expect(childProfiles.rows).toEqual([]);
    expect(audit.events).toEqual([]);
  });

  it('refuses an actor without the permission before looking at the input', async () => {
    const { deps, childProfiles, securityAudit } = build({ ...PARENT_A, roles: [] });

    const result = await new CreateChildProfile(deps).execute({
      displayName: '',
      federalState: 'XX',
      grade: 7,
    });

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'auth.permission_denied' });
    expect(childProfiles.rows).toEqual([]);
    expect(securityAudit.events).toHaveLength(1);
  });
});
