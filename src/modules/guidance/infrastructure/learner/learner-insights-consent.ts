import { getLearnerQueries } from '@modules/learner';

import type { LearningInsightsConsent } from '../../domain/ports/insight-sources.port';

/**
 * Asks the learner module, which loads the profile in the actor's tenant and checks that the actor
 * is its guardian (`learner.read`). Only the learning-notes switch crosses back (#35).
 */
export const learnerInsightsConsent: LearningInsightsConsent = {
  isEnabled: (childProfileId) =>
    getLearnerQueries()
      .getChildProfileById.execute(childProfileId)
      .map((profile) => profile.controls.learningInsights),
};
