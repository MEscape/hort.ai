import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ClassAssignment } from '../insights/class-overview';
import type { ChildProfileId } from '../models/ids';

export type InsightSourceError =
  AuthorizationError | NotFoundAppError | ValidationAppError | InfrastructureAppError;

/** Whether the parent switched learning notes on for their own child (#35); another's is not found. */
export interface LearningInsightsConsent {
  isEnabled(childProfileId: ChildProfileId): AppResultAsync<boolean, InsightSourceError>;
}

/** Assignment titles, read through the assignments module, which authorizes every read itself. */
export interface InsightAssignments {
  /** Id -> title of the assignments of the parent's own child's current class. */
  titlesForChild(
    childProfileId: ChildProfileId,
  ): AppResultAsync<ReadonlyMap<string, string>, InsightSourceError>;

  /**
   * The assignments of one of the signed-in teacher's own active classes; `null` when the class is
   * not theirs (another teacher's, a guess, archived).
   */
  ofOwnClass(
    classroomId: string,
  ): AppResultAsync<readonly ClassAssignment[] | null, InsightSourceError>;
}

/** Code -> short text of public curriculum competencies, for naming a session's topic. */
export interface CompetencyLabels {
  describe(
    codes: readonly string[],
  ): AppResultAsync<ReadonlyMap<string, string>, InfrastructureAppError>;
}
