import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { err, errAsync, ok, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import {
  LEARNER_VALIDATION_CODES,
  childProfileNotFound,
  fieldValidationFailed,
} from '../../domain/errors/learner-errors';
import { isFederalState, isGrade } from '../../domain/models/federal-state';
import { toChildProfileView } from '../learner-view-mappers';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';

import type { SchoolSettings } from '../../domain/ports/child-profile.repository';
import type { AdoptSchoolSettingsInput } from '../contracts/learner-inputs';
import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

export type AdoptSchoolSettingsError =
  LoadChildProfileError | ValidationAppError | InfrastructureAppError;

function parseSchoolSettings(
  input: AdoptSchoolSettingsInput,
): AppResult<SchoolSettings, ValidationAppError> {
  const { federalState, grade } = input;
  if (!isFederalState(federalState)) {
    return err(fieldValidationFailed('federalState', LEARNER_VALIDATION_CODES.federalStateInvalid));
  }
  if (!isGrade(grade)) {
    return err(fieldValidationFailed('grade', LEARNER_VALIDATION_CODES.gradeInvalid));
  }
  return ok({ federalState, grade });
}

/**
 * Copies a class's federal state and grade into one of the signed-in parent's own child profiles,
 * finished or not, when the child joins that class (classroom module, #32).
 *
 * @audit-exempt Only the classroom module's join calls it, and that join is audited there.
 */
export class AdoptSchoolSettings {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(
    input: AdoptSchoolSettingsInput,
  ): AppResultAsync<ChildProfileView, AdoptSchoolSettingsError> {
    return loadAuthorizedChildProfile(this.deps, input.profileId, 'learner.update').andThen(
      ({ childProfile }) =>
        parseSchoolSettings(input)
          .asyncAndThen((settings) =>
            this.deps.childProfiles.updateSchoolSettings(childProfile, settings),
          )
          .andThen((stored) =>
            stored === null
              ? errAsync(childProfileNotFound())
              : okAsync(toChildProfileView(stored)),
          ),
    );
  }
}
