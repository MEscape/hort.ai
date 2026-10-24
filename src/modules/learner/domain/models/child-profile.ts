import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { LEARNER_VALIDATION_CODES, createLearnerErrorBag } from '../errors/learner-errors';

import { isFederalState, isGrade } from './federal-state';
import { LEARNER_LIMITS } from './learner-limits';
import { GUARDIAN_CONSENT_VERSION } from './parent-controls';

import type { FederalState, Grade } from './federal-state';
import type { ActorId, ChildProfileId, TenantId, TutorId } from './ids';
import type { Interest } from './interests';
import type { ParentControls } from './parent-controls';
import type { SetupStep } from './setup-step';

const CODES = LEARNER_VALIDATION_CODES;

/** Control and format characters (newlines, zero-width and bidi marks): never part of a child's name. */
const UNSAFE_NAME_CHARACTERS = /[\p{Cc}\p{Cf}]/u;

/** The guardian's confirmation that they may decide for the child, and which statement they confirmed. */
export interface GuardianConfirmation {
  readonly confirmedAt: Date;
  readonly consentVersion: string;
}

/**
 * The minimum the product keeps about a child (vision.md: display name, federal state, grade), plus
 * what the parent chose during setup from closed lists: interests, companion and controls. The
 * parent owns it through `ownerId`.
 */
export interface ChildProfile {
  readonly id: ChildProfileId;
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
  readonly displayName: string;
  readonly federalState: FederalState;
  readonly grade: Grade;
  readonly interests: readonly Interest[];
  /** A selectable tutor of the catalog, or `null` while none is chosen. */
  readonly tutorId: TutorId | null;
  readonly controls: ParentControls;
  readonly guardian: GuardianConfirmation | null;
  /** The furthest step the parent has reached; only moves forward. */
  readonly setupStep: SetupStep;
  readonly setupCompletedAt: Date | null;
  readonly createdAt: Date;
}

/** Raw details of a child, before validation. */
interface ChildDetailsInput {
  readonly displayName: string;
  readonly federalState: string;
  readonly grade: number;
}

/** Validated details of a child. */
export interface ChildDetails {
  readonly displayName: string;
  readonly federalState: FederalState;
  readonly grade: Grade;
}

function displayNameViolation(name: string): string | null {
  const length = Array.from(name).length;
  if (length < LEARNER_LIMITS.displayNameMin) {
    return CODES.displayNameRequired;
  }
  if (length > LEARNER_LIMITS.displayNameMax) {
    return CODES.displayNameTooLong;
  }
  return UNSAFE_NAME_CHARACTERS.test(name) ? CODES.displayNameInvalid : null;
}

/** The only way a child's details enter the system. Reports every invalid field at once. */
export function createChildDetails(
  input: ChildDetailsInput,
): AppResult<ChildDetails, ValidationAppError> {
  const bag = createLearnerErrorBag();
  const displayName = input.displayName.trim();

  const nameViolation = displayNameViolation(displayName);
  if (nameViolation !== null) {
    bag.add('displayName', nameViolation);
  }
  const { federalState, grade } = input;
  if (!isFederalState(federalState)) {
    bag.add('federalState', CODES.federalStateInvalid);
  }
  if (!isGrade(grade)) {
    bag.add('grade', CODES.gradeInvalid);
  }

  if (bag.hasErrors || !isFederalState(federalState) || !isGrade(grade)) {
    return err(bag.toError());
  }
  return ok({ displayName, federalState, grade });
}

/** The profile as it is once the parent has finished the setup. */
export function withSetupCompleted(profile: ChildProfile, completedAt: Date): ChildProfile {
  return { ...profile, setupStep: 'done', setupCompletedAt: completedAt };
}

export function isSetupComplete(profile: ChildProfile): boolean {
  return profile.setupCompletedAt !== null;
}

/**
 * The guardian confirmation after a save of the controls at `now`: the first confirmation keeps its
 * time while the statement is unchanged, a new statement version replaces it.
 */
export function confirmGuardian(
  previous: GuardianConfirmation | null,
  now: Date,
): GuardianConfirmation {
  return previous?.consentVersion === GUARDIAN_CONSENT_VERSION
    ? previous
    : { confirmedAt: now, consentVersion: GUARDIAN_CONSENT_VERSION };
}

/** Whether the guardian confirmed the statement that is current. */
export function hasCurrentGuardianConfirmation(profile: ChildProfile): boolean {
  return profile.guardian?.consentVersion === GUARDIAN_CONSENT_VERSION;
}
