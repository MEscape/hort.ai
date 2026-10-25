import type { FederalState, Grade } from '../../domain/models/federal-state';
import type { Interest } from '../../domain/models/interests';
import type { ParentControls } from '../../domain/models/parent-controls';
import type { SetupStep } from '../../domain/models/setup-step';

export type { SetupStep };

/** The parent's controls as the parent sees them. */
export type ParentControlsView = ParentControls;

/**
 * A child profile for its parent: the minimum the product keeps, plus what the parent chose. The
 * tenant and the owner are internal and are not exposed.
 */
export interface ChildProfileView {
  readonly id: string;
  readonly displayName: string;
  readonly federalState: FederalState;
  readonly grade: Grade;
  readonly interests: readonly Interest[];
  /** The chosen companion's catalog id, or `null` while none is chosen. */
  readonly tutorId: string | null;
  readonly controls: ParentControlsView;
  /** Whether the guardian confirmed the statement that is current. */
  readonly guardianConfirmed: boolean;
  /** The furthest step the parent has reached. */
  readonly setupStep: SetupStep;
  /** UTC instant the parent finished the setup; `null` while it is open. */
  readonly setupCompletedAt: Date | null;
  /** UTC instant the child finished their welcome; `null` while it is open. */
  readonly welcomeCompletedAt: Date | null;
}

export interface OnboardingStateView {
  readonly step: SetupStep;
  readonly profile: ChildProfileView | null;
}
