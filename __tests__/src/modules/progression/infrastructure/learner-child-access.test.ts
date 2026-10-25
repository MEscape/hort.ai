import { describe, expect, it } from 'vitest';

import { toChildProfileId } from '@modules/progression/domain/models/ids';
import { createLearnerChildAccess } from '@modules/progression/infrastructure/children/learner-child-access';

import { forbiddenError, notFoundError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

/** The learner module's lookup by id: `owned` ids resolve, every other one is "not found". */
const accessWith = (...owned: string[]) =>
  createLearnerChildAccess({
    getChildProfileById: {
      execute: (id: string) =>
        owned.includes(id)
          ? okAsync({ id })
          : errAsync(notFoundError('learner.child_profile_not_found', 'Not found.')),
    },
  } as never);

describe('createLearnerChildAccess', () => {
  it('owns the child the learner module finds for the signed-in parent', async () => {
    const owned = await accessWith('child-1').ownsChild(toChildProfileId('child-1'));

    expect(owned._unsafeUnwrap()).toBe(true);
  });

  it('asks by id, so a second own child is owned too', async () => {
    const owned = await accessWith('child-1', 'child-2').ownsChild(toChildProfileId('child-2'));

    expect(owned._unsafeUnwrap()).toBe(true);
  });

  it('does not own any other id: a foreign or unknown child reads as not owned', async () => {
    const owned = await accessWith('child-1').ownsChild(toChildProfileId('child-2'));

    expect(owned._unsafeUnwrap()).toBe(false);
  });

  it('passes a refusal and the learner module’s failure on instead of answering', async () => {
    const denied = forbiddenError('auth.permission_denied', 'Denied.');
    const failure = { kind: 'infrastructure', code: 'learner.persistence_failed', message: 'x' };
    for (const error of [denied, failure]) {
      const access = createLearnerChildAccess({
        getChildProfileById: { execute: () => errAsync(error) },
      } as never);

      const owned = await access.ownsChild(toChildProfileId('child-1'));

      expect(owned._unsafeUnwrapErr()).toEqual(error);
    }
  });
});
