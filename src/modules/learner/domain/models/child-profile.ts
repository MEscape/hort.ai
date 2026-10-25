import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { LEARNER_VALIDATION_CODES, createLearnerErrorBag } from '../errors/learner-errors';

import { isFederalState, isGrade } from './federal-state';
import { LEARNER_LIMITS } from './learner-limits';
import { GUARDIAN_CONSENT_VERSION, VOICE_NOTICE_VERSION } from './parent-controls';

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

/** The parent's confirmation of the voice notice, and which version of it they confirmed. */
export interface VoiceNoticeConfirmation {
  readonly confirmedAt: Date;
  readonly version: string;
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
  /** Set while the parent allows speech-to-text; `null` before and after a withdrawal. */
  readonly voiceNotice: VoiceNoticeConfirmation | null;
  /** The furthest step the parent has reached; only moves forward. */
  readonly setupStep: SetupStep;
  readonly setupCompletedAt: Date | null;
  /** When the child finished their own welcome after the setup; `null` while it is open. */
  readonly welcomeCompletedAt: Date | null;
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

/** The profile as it is once the child has finished their welcome. */
export function withWelcomeCompleted(profile: ChildProfile, completedAt: Date): ChildProfile {
  return { ...profile, welcomeCompletedAt: completedAt };
}

export function isWelcomeComplete(profile: ChildProfile): boolean {
  return profile.welcomeCompletedAt !== null;
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

/**
 * The voice notice confirmation that goes with the voice control: none while voice is off, the
 * stored one while it is for the current notice, else a new one from `now`. The caller has checked
 * that the parent was shown the current notice.
 */
export function confirmVoiceNotice(
  previous: VoiceNoticeConfirmation | null,
  voiceEnabled: boolean,
  now: Date,
): VoiceNoticeConfirmation | null {
  if (!voiceEnabled) {
    return null;
  }
  return previous?.version === VOICE_NOTICE_VERSION
    ? previous
    : { confirmedAt: now, version: VOICE_NOTICE_VERSION };
}

/** Whether the guardian confirmed the statement that is current. */
export function hasCurrentGuardianConfirmation(profile: ChildProfile): boolean {
  return profile.guardian?.consentVersion === GUARDIAN_CONSENT_VERSION;
}

/**
 * Whether a child's recordings may be sent for transcription (#34): the voice control is on, the
 * parent confirmed the voice notice that is current, and the guardian confirmation is current too.
 * Anything else, including a notice of an older version, is no consent.
 */
export function hasCurrentVoiceConsent(profile: ChildProfile): boolean {
  return (
    profile.controls.voiceEnabled &&
    profile.voiceNotice?.version === VOICE_NOTICE_VERSION &&
    hasCurrentGuardianConfirmation(profile)
  );
}
