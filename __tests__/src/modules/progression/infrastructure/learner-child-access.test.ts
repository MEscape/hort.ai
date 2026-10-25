import { describe, expect, it } from 'vitest';

import { toChildProfileId } from '@modules/progression/domain/models/ids';
import { createLearnerChildAccess } from '@modules/progression/infrastructure/children/learner-child-access';

import { errAsync, okAsync } from '@lib/result';

const accessWith = (profile: { id: string } | null) =>
  createLearnerChildAccess({
    getOnboardingState: { execute: () => okAsync({ step: 'done', profile }) },
  } as never);

describe('createLearnerChildAccess', () => {
  it('owns the child the learner module reports for the signed-in parent', async () => {
    const owned = await accessWith({ id: 'child-1' }).ownsChild(toChildProfileId('child-1'));

    expect(owned._unsafeUnwrap()).toBe(true);
  });

  it('does not own any other id: a foreign or unknown child reads as not owned', async () => {
    const owned = await accessWith({ id: 'child-1' }).ownsChild(toChildProfileId('child-2'));

    expect(owned._unsafeUnwrap()).toBe(false);
  });

  it('owns nothing while the parent has no profile', async () => {
    const owned = await accessWith(null).ownsChild(toChildProfileId('child-1'));

    expect(owned._unsafeUnwrap()).toBe(false);
  });

  it('passes the learner module’s failure on instead of answering "not owned"', async () => {
    const failure = { kind: 'infrastructure', code: 'learner.persistence_failed', message: 'x' };
    const access = createLearnerChildAccess({
      getOnboardingState: { execute: () => errAsync(failure) },
    } as never);

    const owned = await access.ownsChild(toChildProfileId('child-1'));

    expect(owned._unsafeUnwrapErr()).toEqual(failure);
  });
});
