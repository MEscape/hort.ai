import { getLearnerQueries } from '@modules/learner';

import { toChildProfileId } from '../../domain/models/ids';

import type { ChildProfileAccess } from '../../domain/ports/child-profile-access.port';

/**
 * Asks the learner module, which loads the profile in the actor's tenant and checks that the
 * actor is its guardian (`learner.read`). Only the id, state and grade cross back; the rest of the
 * profile stays there.
 */
export const learnerChildProfileAccess: ChildProfileAccess = {
  findOwn: (id) =>
    getLearnerQueries()
      .getChildProfileById.execute(id)
      .map((profile) => ({
        id: toChildProfileId(profile.id),
        federalState: profile.federalState,
        grade: profile.grade,
        controls: profile.controls,
      })),
};
