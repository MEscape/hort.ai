import type { ChildProfileView } from '@modules/learner';

import type { AppResultAsync } from '@lib/result';

import type {
  ChildProfileAccess,
  ChildProfileAccessError,
} from '../../domain/ports/child-profile-access.port';

/** The two learner use cases this module needs, as the learner module's public API offers them. */
export interface LearnerUseCases {
  readonly getChildProfileById: {
    execute(id: string): AppResultAsync<ChildProfileView, ChildProfileAccessError>;
  };
  readonly updateChildProfile: {
    execute(input: {
      readonly id: string;
      readonly federalState?: string;
      readonly grade?: number;
    }): AppResultAsync<ChildProfileView, ChildProfileAccessError>;
  };
}

/**
 * `ChildProfileAccess` over the learner module's own use cases, which authorize the signed-in
 * parent on the stored profile (`learner.read` / `learner.update`) and audit the change.
 */
export class LearnerChildProfileAccess implements ChildProfileAccess {
  constructor(private readonly learner: LearnerUseCases) {}

  requireOwnChild(childProfileId: string): AppResultAsync<void, ChildProfileAccessError> {
    return this.learner.getChildProfileById.execute(childProfileId).map(() => undefined);
  }

  adoptClassroomSettings(
    childProfileId: string,
    settings: { readonly federalState: string; readonly grade: number },
  ): AppResultAsync<void, ChildProfileAccessError> {
    return this.learner.updateChildProfile
      .execute({ id: childProfileId, federalState: settings.federalState, grade: settings.grade })
      .map(() => undefined);
  }
}
