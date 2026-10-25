import { describe, expect, it } from 'vitest';

import { GetChildProfileById } from '@modules/learner/application/queries/get-child-profile-by-id';

import { PARENT_A, PARENT_B, build, profileOf } from '../fakes';

describe('GetChildProfileById', () => {
  it('returns the parent’s own profile with the voice control', async () => {
    const own = profileOf({ id: 'own' });
    const { deps } = build(PARENT_A, own);

    const view = (await new GetChildProfileById(deps).execute('own'))._unsafeUnwrap();

    expect(view).toMatchObject({
      id: 'own',
      displayName: 'Lisa',
      controls: { voiceEnabled: false },
    });
  });

  it('answers another parent’s profile exactly like an unknown id', async () => {
    const theirs = profileOf({ id: 'theirs', ownerId: PARENT_B.id });
    const query = new GetChildProfileById(build(PARENT_A, theirs).deps);

    const foreign = await query.execute('theirs');
    const unknown = await query.execute('nobody');

    expect(foreign._unsafeUnwrapErr()).toEqual(unknown._unsafeUnwrapErr());
    expect(foreign._unsafeUnwrapErr()).toMatchObject({ code: 'learner.not_found' });
  });
});
