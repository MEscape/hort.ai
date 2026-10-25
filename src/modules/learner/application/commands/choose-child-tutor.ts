import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  LEARNER_VALIDATION_CODES,
  fieldValidationFailed,
} from '../../domain/errors/learner-errors';
import { parseTutorId } from '../../domain/models/ids';
import { toChildProfileView } from '../learner-view-mappers';
import { loadAuthorizedChildProfile } from '../load-authorized-child-profile';
import { requirePendingWelcome } from '../services/require-pending-welcome';
import { storeWelcomeChoice } from '../services/store-welcome-choice';

import type { ChooseChildTutorInput } from '../contracts/learner-inputs';
import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

export type ChooseChildTutorError =
  LoadChildProfileError | ConflictAppError | ValidationAppError | InfrastructureAppError;

/**
 * The child's own choice of the companion during the welcome. Only a tutor the catalog offers as
 * ready can be chosen (a field error on `tutorId` otherwise). Changes only the tutor; the audit
 * event names the tutor (catalog data, not child data) when the choice changed.
 */
export class ChooseChildTutor {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(input: ChooseChildTutorInput): AppResultAsync<ChildProfileView, ChooseChildTutorError> {
    const { audit, tutors } = this.deps;

    return loadAuthorizedChildProfile(this.deps, input.profileId, 'learner.update')
      .andThen(requirePendingWelcome)
      .andThen(({ actor, childProfile }) =>
        parseTutorId(input.tutorId)
          .andThen((tutorId) =>
            tutors.isSelectable(tutorId)
              ? ok(tutorId)
              : err(fieldValidationFailed('tutorId', LEARNER_VALIDATION_CODES.tutorInvalid)),
          )
          .asyncAndThen((tutorId) =>
            storeWelcomeChoice(this.deps, childProfile, { tutorId }).map((stored) => {
              if (childProfile.tutorId !== tutorId) {
                audit.record({
                  type: 'learner.child_tutor_chosen',
                  actorId: actor.id,
                  tenantId: actor.tenantId,
                  childProfileId: stored.id,
                  tutorId,
                });
              }
              return toChildProfileView(stored);
            }),
          ),
      );
  }
}
