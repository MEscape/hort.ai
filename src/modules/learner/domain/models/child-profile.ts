import type { ActorId, TenantId } from '@modules/auth';

import type { FieldErrorBag, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { literalGuard } from '@lib/utils';

import { createLearnerErrorBag, LEARNER_VALIDATION_CODES } from '../errors/learner-errors';

import type { ChildProfileId } from './ids';

const CODES = LEARNER_VALIDATION_CODES;

/** Field bounds. Presentation reads them through the application's constraints contract. */
export const CHILD_PROFILE_LIMITS = {
  displayNameMax: 40,
  gradeMin: 1,
  gradeMax: 4,
} as const;

/** Primary school: grades 1 to 4 (#5). A whole number in that range, nothing else. */
function isValidGrade(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= CHILD_PROFILE_LIMITS.gradeMin &&
    value <= CHILD_PROFILE_LIMITS.gradeMax
  );
}

export const CHILD_PROFILE_FEDERAL_STATES = [
  'bw',
  'by',
  'be',
  'bb',
  'hb',
  'hh',
  'he',
  'mv',
  'ni',
  'nw',
  'rp',
  'sl',
  'sn',
  'st',
  'sh',
  'th',
] as const;
export type ChildProfileFederalState = (typeof CHILD_PROFILE_FEDERAL_STATES)[number];
export const isChildProfileFederalState = literalGuard(CHILD_PROFILE_FEDERAL_STATES);

export const CHILD_PROFILE_COMPANIONS = ['max', 'lili', 'fina'] as const;
export type ChildProfileCompanion = (typeof CHILD_PROFILE_COMPANIONS)[number];
export const isChildProfileCompanion = literalGuard(CHILD_PROFILE_COMPANIONS);

/**
 * A stored child profile. It holds only what the product needs (#9): a display name, federal state,
 * grade, the chosen companion and the voice consent. `ownerId` is the parent (guardian) it belongs
 * to; tenant and owner are internal and never leave the module's views.
 */
export interface ChildProfile {
  readonly id: ChildProfileId;
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
  readonly displayName: string;
  readonly federalState: ChildProfileFederalState;
  readonly grade: number;
  readonly companion: ChildProfileCompanion | null;
  readonly voiceConsent: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Raw input for a new child profile, before validation. */
export interface ChildProfileDraftInput {
  readonly displayName: string;
  readonly federalState: string;
  readonly grade: number;
  readonly companion?: string | null | undefined;
  /** Off unless the parent turns it on (#34). */
  readonly voiceConsent?: boolean | undefined;
}

/** A validated child profile, ready to be stored. */
export interface ChildProfileDraft {
  readonly displayName: string;
  readonly federalState: ChildProfileFederalState;
  readonly grade: number;
  readonly companion: ChildProfileCompanion | null;
  readonly voiceConsent: boolean;
}

/** `undefined` leaves a field alone; `null` clears an optional one. */
export interface ChildProfileChangesInput {
  readonly displayName?: string | undefined;
  readonly federalState?: string | undefined;
  readonly grade?: number | undefined;
  readonly companion?: string | null | undefined;
  readonly voiceConsent?: boolean | undefined;
}

export interface ChildProfileChanges {
  readonly displayName?: string;
  readonly federalState?: ChildProfileFederalState;
  readonly grade?: number;
  readonly companion?: ChildProfileCompanion | null;
  readonly voiceConsent?: boolean;
}

/** Which field a text check reports on, and how long it may be. */
interface TextRule {
  readonly field: string;
  readonly max: number;
}

function checkRequiredText(value: string, rule: TextRule, bag: FieldErrorBag): void {
  if (value.length === 0) {
    bag.add(rule.field, CODES.required);
  } else if (value.length > rule.max) {
    bag.add(rule.field, CODES.tooLong);
  }
}

function readDisplayName(input: ChildProfileDraftInput, bag: FieldErrorBag): string {
  const value = input.displayName.trim();
  checkRequiredText(value, { field: 'displayName', max: CHILD_PROFILE_LIMITS.displayNameMax }, bag);
  return value;
}

function readFederalState(
  input: ChildProfileDraftInput,
  bag: FieldErrorBag,
): ChildProfileFederalState | null {
  if (!isChildProfileFederalState(input.federalState)) {
    bag.add('federalState', CODES.optionUnknown);
    return null;
  }
  return input.federalState;
}

function readGrade(input: ChildProfileDraftInput, bag: FieldErrorBag): number {
  const value = input.grade;
  if (!isValidGrade(value)) {
    bag.add('grade', CODES.numberInvalid);
  }
  return value;
}

function readCompanion(
  input: ChildProfileDraftInput,
  bag: FieldErrorBag,
): ChildProfileCompanion | null {
  const raw = input.companion ?? null;
  if (raw === null) {
    return null;
  }
  if (!isChildProfileCompanion(raw)) {
    bag.add('companion', CODES.optionUnknown);
    return null;
  }
  return raw;
}

function changeDisplayName(
  input: ChildProfileChangesInput,
  bag: FieldErrorBag,
): ChildProfileChanges {
  if (input.displayName === undefined) {
    return {};
  }
  const value = input.displayName.trim();
  checkRequiredText(value, { field: 'displayName', max: CHILD_PROFILE_LIMITS.displayNameMax }, bag);
  return { displayName: value };
}

function changeFederalState(
  input: ChildProfileChangesInput,
  bag: FieldErrorBag,
): ChildProfileChanges {
  if (input.federalState === undefined) {
    return {};
  }
  if (!isChildProfileFederalState(input.federalState)) {
    bag.add('federalState', CODES.optionUnknown);
    return {};
  }
  return { federalState: input.federalState };
}

function changeGrade(input: ChildProfileChangesInput, bag: FieldErrorBag): ChildProfileChanges {
  if (input.grade === undefined) {
    return {};
  }
  if (!isValidGrade(input.grade)) {
    bag.add('grade', CODES.numberInvalid);
  }
  return { grade: input.grade };
}

function changeCompanion(input: ChildProfileChangesInput, bag: FieldErrorBag): ChildProfileChanges {
  if (input.companion === undefined) {
    return {};
  }
  if (input.companion === null) {
    return { companion: null };
  }
  if (!isChildProfileCompanion(input.companion)) {
    bag.add('companion', CODES.optionUnknown);
    return {};
  }
  return { companion: input.companion };
}

function changeVoiceConsent(input: ChildProfileChangesInput): ChildProfileChanges {
  if (input.voiceConsent === undefined) {
    return {};
  }
  return { voiceConsent: input.voiceConsent };
}

/** The only way a new child profile enters the system. Reports every invalid field. */
export function createChildProfileDraft(
  input: ChildProfileDraftInput,
): AppResult<ChildProfileDraft, ValidationAppError> {
  const bag = createLearnerErrorBag();
  const displayName = readDisplayName(input, bag);
  const federalState = readFederalState(input, bag);
  const grade = readGrade(input, bag);
  const companion = readCompanion(input, bag);
  const voiceConsent = input.voiceConsent ?? false;

  if (bag.hasErrors || federalState === null) {
    return err(bag.toError());
  }
  return ok({ displayName, federalState, grade, companion, voiceConsent });
}

/** Validates a partial update; only the fields that were provided are checked. */
export function parseChildProfileChanges(
  input: ChildProfileChangesInput,
): AppResult<ChildProfileChanges, ValidationAppError> {
  const bag = createLearnerErrorBag();
  const changes: ChildProfileChanges = {
    ...changeDisplayName(input, bag),
    ...changeFederalState(input, bag),
    ...changeGrade(input, bag),
    ...changeCompanion(input, bag),
    ...changeVoiceConsent(input),
  };

  return bag.hasErrors ? err(bag.toError()) : ok(changes);
}

export function isEmptyChanges(changes: ChildProfileChanges): boolean {
  return Object.keys(changes).length === 0;
}
