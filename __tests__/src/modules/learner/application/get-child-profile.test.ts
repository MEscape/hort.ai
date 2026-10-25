import { describe, expect, it } from 'vitest';

import { GetChildProfile } from '@modules/learner/application/queries/get-child-profile';
import { toTenantId } from '@modules/learner/domain/models/ids';

import { PARENT_A, PARENT_B, build, profileOf } from '../fakes';

describe('GetChildProfile', () => {
  it('returns the parent’s own profile', async () => {
    const { deps } = build(PARENT_A, profileOf({ id: 'own' }));

    const view = (await new GetChildProfile(deps).execute('own'))._unsafeUnwrap();

    expect(view).toMatchObject({ id: 'own', displayName: 'Lisa', setupStep: 'interests' });
  });

  it('answers another parent’s profile exactly like an unknown id', async () => {
    const { deps } = build(PARENT_A, profileOf({ id: 'theirs', ownerId: PARENT_B.id }));
    const get = new GetChildProfile(deps);

    const foreign = await get.execute('theirs');
    const unknown = await get.execute('nobody');

    expect(foreign._unsafeUnwrapErr()).toEqual(unknown._unsafeUnwrapErr());
    expect(foreign._unsafeUnwrapErr()).toMatchObject({ code: 'learner.not_found' });
  });

  it('does not reach a profile of another tenant', async () => {
    const { deps } = build(PARENT_A, profileOf({ id: 'own', tenantId: toTenantId('other') }));

    const result = await new GetChildProfile(deps).execute('own');

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'learner.not_found' });
  });

  it('refuses an actor without the permission before any lookup', async () => {
    const { deps, securityAudit } = build({ ...PARENT_A, roles: [] }, profileOf({ id: 'own' }));

    const result = await new GetChildProfile(deps).execute('own');

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'auth.permission_denied' });
    expect(securityAudit.events).toHaveLength(1);
  });
});
