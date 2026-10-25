import { getLearnerQueries } from '@modules/learner';

import type { ChildAccessPort } from '../../domain/ports/child-access.port';

/**
 * Asks the learner module, which owns the child profile and answers for the signed-in parent's own
 * profiles only. A profile of another parent is not among them, so it reads as "not owned".
 *
 * shortcut: the learner module lists one profile per parent (one child in the MVP), so ownership is
 * "the id is that profile"; switch to a lookup by id when the learner module offers one for several children.
 */
export function createLearnerChildAccess(
  queries: Pick<ReturnType<typeof getLearnerQueries>, 'getOnboardingState'> = getLearnerQueries(),
): ChildAccessPort {
  return {
    ownsChild: (id) =>
      queries.getOnboardingState.execute().map((state) => state.profile?.id === id),
  };
}
