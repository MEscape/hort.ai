import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';

import { isFederalState, isGrade } from '../../domain/models/federal-state';
import { toActorId, toChildProfileId, toTenantId, toTutorId } from '../../domain/models/ids';
import { isInterest } from '../../domain/models/interests';
import { isDailyLimit } from '../../domain/models/parent-controls';
import { isSetupStep } from '../../domain/models/setup-step';

import type {
  ChildProfile,
  GuardianConfirmation,
  VoiceNoticeConfirmation,
} from '../../domain/models/child-profile';
import type { ParentControls } from '../../domain/models/parent-controls';

/** The columns the module reads, and nothing else, so no generated database type leaves this layer. */
export interface ChildProfileRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly federalState: string;
  readonly grade: number;
  /** The parent's "voice allowed" control; the column keeps the name it was created with. */
  readonly voiceConsent: boolean;
  readonly setupStep: string;
  readonly interests: readonly string[];
  readonly tutorId: string | null;
  readonly dailyLimitMinutes: number | null;
  readonly allowedFromMinute: number | null;
  readonly allowedUntilMinute: number | null;
  readonly learningInsights: boolean;
  readonly guardianConfirmedAt: InstantRecord | null;
  readonly guardianConsentVersion: string | null;
  readonly setupCompletedAt: InstantRecord | null;
  readonly voiceNoticeVersion: string | null;
  readonly voiceNoticeConfirmedAt: InstantRecord | null;
  readonly createdAt: InstantRecord;
}

export const CHILD_PROFILE_SELECT = [
  'id',
  'tenantId',
  'ownerId',
  'displayName',
  'federalState',
  'grade',
  'voiceConsent',
  'setupStep',
  'interests',
  'tutorId',
  'dailyLimitMinutes',
  'allowedFromMinute',
  'allowedUntilMinute',
  'learningInsights',
  'guardianConfirmedAt',
  'guardianConsentVersion',
  'setupCompletedAt',
  'voiceNoticeVersion',
  'voiceNoticeConfirmedAt',
  'createdAt',
] as const satisfies ReadonlyArray<keyof ChildProfileRecord>;

function controlsOf(record: ChildProfileRecord): ParentControls | null {
  const { dailyLimitMinutes, allowedFromMinute, allowedUntilMinute } = record;
  if (dailyLimitMinutes !== null && !isDailyLimit(dailyLimitMinutes)) {
    return null;
  }
  return {
    voiceEnabled: record.voiceConsent,
    dailyLimitMinutes,
    // The CHECK constraint keeps the two columns both set or both empty.
    allowedWindow:
      allowedFromMinute === null || allowedUntilMinute === null
        ? null
        : { fromMinute: allowedFromMinute, untilMinute: allowedUntilMinute },
    learningInsights: record.learningInsights,
  };
}

function guardianOf(record: ChildProfileRecord): GuardianConfirmation | null {
  const { guardianConfirmedAt, guardianConsentVersion } = record;
  return guardianConfirmedAt === null || guardianConsentVersion === null
    ? null
    : { confirmedAt: instantToDate(guardianConfirmedAt), consentVersion: guardianConsentVersion };
}

function voiceNoticeOf(record: ChildProfileRecord): VoiceNoticeConfirmation | null {
  const { voiceNoticeConfirmedAt, voiceNoticeVersion } = record;
  // The CHECK constraint keeps the two columns both set or both empty.
  return voiceNoticeConfirmedAt === null || voiceNoticeVersion === null
    ? null
    : { confirmedAt: instantToDate(voiceNoticeConfirmedAt), version: voiceNoticeVersion };
}

/**
 * `null` for a row whose state, grade, step, interests or limit this build does not know. The
 * database CHECK constraints keep such a row from existing; it is left out rather than trusted.
 */
export function toChildProfile(record: ChildProfileRecord): ChildProfile | null {
  const { federalState, grade, setupStep, setupCompletedAt, interests } = record;
  const controls = controlsOf(record);
  if (
    !isFederalState(federalState) ||
    !isGrade(grade) ||
    !isSetupStep(setupStep) ||
    !interests.every(isInterest) ||
    controls === null
  ) {
    return null;
  }
  return {
    id: toChildProfileId(record.id),
    tenantId: toTenantId(record.tenantId),
    ownerId: toActorId(record.ownerId),
    displayName: record.displayName,
    federalState,
    grade,
    interests,
    tutorId: record.tutorId === null ? null : toTutorId(record.tutorId),
    controls,
    guardian: guardianOf(record),
    voiceNotice: voiceNoticeOf(record),
    setupStep,
    setupCompletedAt: setupCompletedAt === null ? null : instantToDate(setupCompletedAt),
    createdAt: instantToDate(record.createdAt),
  };
}
