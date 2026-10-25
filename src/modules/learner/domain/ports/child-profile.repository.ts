import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type {
  ChildDetails,
  ChildProfile,
  GuardianConfirmation,
  VoiceNoticeConfirmation,
} from '../models/child-profile';
import type { FederalState, Grade } from '../models/federal-state';
import type { ActorId, ChildProfileId, TenantId, TutorId } from '../models/ids';
import type { Interest } from '../models/interests';
import type { ParentControls } from '../models/parent-controls';
import type { SetupStep } from '../models/setup-step';

/** What `saveUnfinished` stores: a parent's details of their child. */
export interface UnfinishedProfileInput {
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
  readonly details: ChildDetails;
}

/** Whose profiles an operation reaches: the signed-in parent's own, in their own tenant. */
export interface ProfileOwner {
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
}

/** What a step of the setup stores: only the parts it names are written. */
export interface ProfilePatch {
  readonly interests?: readonly Interest[];
  readonly tutorId?: TutorId;
  readonly controls?: ParentControls;
  readonly guardian?: GuardianConfirmation;
}

/** The school data a class decides for its children. */
export interface SchoolSettings {
  readonly federalState: FederalState;
  readonly grade: Grade;
}

/** The parent's speech-to-text decision: the voice control and the notice confirmed with it. */
export interface VoiceConsentWrite {
  readonly voiceEnabled: boolean;
  /** `null` clears it: a withdrawal leaves no confirmation behind. */
  readonly voiceNotice: VoiceNoticeConfirmation | null;
}

/** What the child's welcome may change: only the interests and the companion. */
export type WelcomePatch = Pick<ProfilePatch, 'interests' | 'tutorId'>;

export interface SavedProfile {
  readonly profile: ChildProfile;
  /** Whether this call inserted the profile (`false`: it replaced the details of the existing one). */
  readonly isNew: boolean;
}

/**
 * Persistence for child profiles. Every read and write takes the owner and the tenant, so another
 * parent's id behaves exactly like an id that does not exist.
 *
 * Finders return `null` for "absent"; deciding that absence is an error is the use case's job.
 * Adapters translate every driver failure into our own error kinds (errors.md).
 */
export interface ChildProfileRepository {
  /** Updates the finished profile's time and notes controls without writing voice, companion or interests. */
  updateParentControls(
    profile: ChildProfile,
    controls: Omit<ParentControls, 'voiceEnabled'>,
  ): AppResultAsync<ChildProfile | null, InfrastructureAppError>;

  /** The parent's own profile, or `null` for an unknown id and for another parent's alike. */
  findOwned(
    id: ChildProfileId,
    ownerId: ActorId,
    tenantId: TenantId,
  ): AppResultAsync<ChildProfile | null, InfrastructureAppError>;

  /** The parent's profiles, oldest first. Bounded: never more than `limit`. */
  listByOwner(
    ownerId: ActorId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly ChildProfile[], InfrastructureAppError>;

  /**
   * Stores the details as the parent's one unfinished profile: inserts it, or replaces the details
   * of the existing one. Repeated and concurrent calls never leave a second unfinished profile
   * (a database constraint guards it). `null` when the parent's profile was finished meanwhile.
   */
  saveUnfinished(
    input: UnfinishedProfileInput,
  ): AppResultAsync<SavedProfile | null, InfrastructureAppError>;

  /**
   * Stores a step's `patch` on an unfinished profile and moves its step forward to at least
   * `reaches` (never back, also under concurrency). Returns the stored profile, or `null` when the
   * profile is finished or gone.
   */
  updateUnfinished(
    profile: ChildProfile,
    patch: ProfilePatch,
    reaches: Exclude<SetupStep, 'child' | 'done'>,
  ): AppResultAsync<ChildProfile | null, InfrastructureAppError>;

  /**
   * Stores a new federal state and grade on one of the owner's profiles, finished or not (a class
   * the child joins sets both). Returns the stored profile, or `null` when it is gone.
   */
  updateSchoolSettings(
    profile: ChildProfile,
    settings: SchoolSettings,
  ): AppResultAsync<ChildProfile | null, InfrastructureAppError>;

  /**
   * Stores the voice control and its notice confirmation on one of the owner's profiles, finished
   * or not (the parent decides after the setup, too). Returns the stored profile, or `null` when it
   * is gone.
   */
  updateVoiceConsent(
    profile: ChildProfile,
    consent: VoiceConsentWrite,
  ): AppResultAsync<ChildProfile | null, InfrastructureAppError>;

  /**
   * Deletes every profile of the owner, finished or not, and nothing of anyone else. Returns how
   * many rows went; 0 is success (idempotent). Only the development reset uses it.
   */
  deleteAllOwned(owner: ProfileOwner): AppResultAsync<number, InfrastructureAppError>;

  /**
   * Finishes the setup of a profile that is at the `review` step, in one conditional statement.
   * `false` when it was finished already or is not at `review` (another call won), so only one
   * call ever reports having completed it.
   */
  markSetupCompleted(
    profile: ChildProfile,
    completedAt: Date,
  ): AppResultAsync<boolean, InfrastructureAppError>;

  /**
   * Stores the interests and/or companion the child changed during their welcome, on a profile
   * whose setup is done and whose welcome is still open. Touches nothing else (not the step).
   * Returns the stored profile, or `null` when the welcome was finished meanwhile or the profile is gone.
   */
  updateWelcomePending(
    profile: ChildProfile,
    patch: WelcomePatch,
  ): AppResultAsync<ChildProfile | null, InfrastructureAppError>;

  /**
   * Finishes the child's welcome, in one conditional statement. `false` when it was finished
   * already or the setup is not done, so only one call ever reports having completed it.
   */
  markWelcomeCompleted(
    profile: ChildProfile,
    completedAt: Date,
  ): AppResultAsync<boolean, InfrastructureAppError>;
}
