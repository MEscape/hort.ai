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
import { requireUnfinishedProfile } from '../services/require-unfinished-profile';
import { storeProfileStep } from '../services/store-profile-step';

import type { ChooseTutorInput } from '../contracts/learner-inputs';
import type { ChildProfileView } from '../contracts/learner-views';
import type { LearnerDependencies } from '../learner-dependencies';
import type { LoadChildProfileError } from '../load-authorized-child-profile';

export type ChooseTutorError =
  LoadChildProfileError | ConflictAppError | ValidationAppError | InfrastructureAppError;

/**
 * Stores the child's companion and advances the setup to at least the controls step. Only a tutor
 * the catalog offers as ready can be chosen; an unknown, draft or empty id is a field error on
 * `tutorId`. The audit event names the tutor (catalog data, not child data) when the choice changed.
 */
export class ChooseTutor {
  constructor(private readonly deps: LearnerDependencies) {}

  execute(input: ChooseTutorInput): AppResultAsync<ChildProfileView, ChooseTutorError> {
    const { audit, tutors } = this.deps;

    return loadAuthorizedChildProfile(this.deps, input.profileId, 'learner.update')
      .andThen(requireUnfinishedProfile)
      .andThen(({ actor, childProfile }) =>
        parseTutorId(input.tutorId)
          .andThen((tutorId) =>
            tutors.isSelectable(tutorId)
              ? ok(tutorId)
              : err(fieldValidationFailed('tutorId', LEARNER_VALIDATION_CODES.tutorInvalid)),
          )
          .asyncAndThen((tutorId) =>
            storeProfileStep(this.deps, {
              profile: childProfile,
              patch: { tutorId },
              reaches: 'controls',
            }).map((stored) => {
              if (childProfile.tutorId !== tutorId) {
                audit.record({
                  type: 'learner.tutor_chosen',
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
