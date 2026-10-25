import type { AppResultAsync } from '@lib/result';
import { errAsync, okAsync } from '@lib/result';

import {
  childProfileNotFound,
  createLearnerErrorBag,
  LEARNER_VALIDATION_CODES,
} from '../../domain/errors/learner-errors';
import { isFederalState, isGrade } from '../../domain/models/federal-state';
import { toChildProfileView } from '../learner-view-mappers';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';

import type { ChildProfile } from '../../domain/models/child-profile';
import type { AdoptClassroomSettingsInput } from '../contracts/learner-inputs';
import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

/**
 * When a child joins a class, its profile takes over the class's federal state and grade (#32),
 * so curriculum grounding follows the class. Only on the signed-in parent's own child.
 */
export class AdoptClassroomSettings {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(
    input: AdoptClassroomSettingsInput,
  ): AppResultAsync<ChildProfileView, LoadChildProfileError> {
    const { childProfiles, audit } = this.deps;
    const { federalState, grade } = input;

    return loadAuthorizedChildProfile(this.deps, input.profileId, 'learner.update').andThen(
      ({ actor, childProfile }) => {
        const bag = createLearnerErrorBag();
        bag.expect(
          isFederalState(federalState),
          'federalState',
          LEARNER_VALIDATION_CODES.federalStateInvalid,
        );
        bag.expect(isGrade(grade), 'grade', LEARNER_VALIDATION_CODES.gradeInvalid);
        if (!isFederalState(federalState) || !isGrade(grade)) {
          return errAsync(bag.toError());
        }
        return childProfiles
          .adoptClassroomSettings(childProfile, { federalState, grade })
          .andThen((stored) =>
            stored === null ? errAsync(childProfileNotFound()) : okAsync<ChildProfile>(stored),
          )
          .map((stored) => {
            audit.record({
              type: 'learner.classroom_settings_adopted',
              actorId: actor.id,
              tenantId: actor.tenantId,
              childProfileId: stored.id,
            });
            return toChildProfileView(stored);
          });
      },
    );
  }
}
