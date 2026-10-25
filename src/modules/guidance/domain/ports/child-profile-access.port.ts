import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ChildProfileId } from '../models/ids';

/** What the parent set for the child's day, as the learner module stores it. */
export interface LearningControls {
  /** `null`: no daily limit. */
  readonly dailyLimitMinutes: number | null;
  /** Minutes since midnight in the learner's time zone, `[from, until)`; `null`: any time. */
  readonly allowedWindow: { readonly fromMinute: number; readonly untilMinute: number } | null;
}

/** A child profile the signed-in parent is the guardian of. */
export interface OwnChildProfile {
  readonly id: ChildProfileId;
  /** ISO 3166-2:DE suffix as the learner module stores it, e.g. `BY`. */
  readonly federalState: string;
  readonly grade: number;
  readonly controls: LearningControls;
}

export type ChildProfileAccessError =
  AuthorizationError | NotFoundAppError | ValidationAppError | InfrastructureAppError;

/**
 * Finds one of the signed-in parent's own child profiles. Another parent's profile, or another
 * tenant's, is "not found": the learner module decides ownership, never the request.
 *
 * The learner module also owns the screen-time rule and its clock (the server's, in the learner's
 * time zone), so guidance asks it what "today" is and whether the child's day is closed.
 */
export interface ChildProfileAccess {
  findOwn(id: ChildProfileId): AppResultAsync<OwnChildProfile, ChildProfileAccessError>;
  /** The child's calendar day so far: from its midnight to now, on the server's clock. */
  today(): { readonly from: Date; readonly to: Date };
  /**
   * Whether the daily limit is used up with `usedMinutes` learned today, or it is outside the
   * allowed hours, right now. `usedMinutes` is `null` when nothing was measured (no limit set).
   */
  isDayClosed(child: OwnChildProfile, usedMinutes: number | null): boolean;
}
