import { toTenantId } from '@modules/auth';

import { dateToInstant, instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';

import { toChildProfileId } from '../../domain/models/ids';

import type {
  ChildProfile,
  ChildProfileChanges,
  ChildProfileCompanion,
  ChildProfileDraft,
  ChildProfileFederalState,
} from '../../domain/models/child-profile';

/**
 * Persistence shapes.
 *
 * Generated Prisma contract types never leave the persistence layer.
 */

export interface ChildProfileRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly displayName: string;
  readonly federalState: ChildProfileFederalStateRecord;
  readonly grade: number;
  readonly companion: ChildProfileCompanionRecord | null;
  readonly voiceConsent: boolean;
  readonly createdAt: InstantRecord;
  readonly updatedAt: InstantRecord;
}

/**
 * Field list for `.select(...)`.
 *
 * Prisma 8 has no `select: { ... }` option. Queries are built by chaining,
 * and `.select()` takes field names as separate arguments, so this is
 * spread at the call site: `.select(...CHILD_PROFILE_SELECT)`.
 * `satisfies` keeps the list in sync with the record shape.
 */
export const CHILD_PROFILE_SELECT = [
  'id',
  'tenantId',
  'displayName',
  'federalState',
  'grade',
  'companion',
  'voiceConsent',
  'createdAt',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof ChildProfileRecord>;

/** Domain value -> stored enum member, and back. Both tables are exhaustive. */
export const CHILD_PROFILE_FEDERAL_STATE_RECORD = {
  bw: 'BW',
  by: 'BY',
  be: 'BE',
  bb: 'BB',
  hb: 'HB',
  hh: 'HH',
  he: 'HE',
  mv: 'MV',
  ni: 'NI',
  nw: 'NW',
  rp: 'RP',
  sl: 'SL',
  sn: 'SN',
  st: 'ST',
  sh: 'SH',
  th: 'TH',
} as const satisfies Record<ChildProfileFederalState, string>;

export type ChildProfileFederalStateRecord =
  (typeof CHILD_PROFILE_FEDERAL_STATE_RECORD)[ChildProfileFederalState];

const CHILD_PROFILE_FEDERAL_STATE_BY_RECORD = {
  BW: 'bw',
  BY: 'by',
  BE: 'be',
  BB: 'bb',
  HB: 'hb',
  HH: 'hh',
  HE: 'he',
  MV: 'mv',
  NI: 'ni',
  NW: 'nw',
  RP: 'rp',
  SL: 'sl',
  SN: 'sn',
  ST: 'st',
  SH: 'sh',
  TH: 'th',
} as const satisfies Record<ChildProfileFederalStateRecord, ChildProfileFederalState>;

/** Domain value -> stored enum member, and back. Both tables are exhaustive. */
export const CHILD_PROFILE_COMPANION_RECORD = {
  max: 'MAX',
  lili: 'LILI',
  fina: 'FINA',
} as const satisfies Record<ChildProfileCompanion, string>;

export type ChildProfileCompanionRecord =
  (typeof CHILD_PROFILE_COMPANION_RECORD)[ChildProfileCompanion];

const CHILD_PROFILE_COMPANION_BY_RECORD = {
  MAX: 'max',
  LILI: 'lili',
  FINA: 'fina',
} as const satisfies Record<ChildProfileCompanionRecord, ChildProfileCompanion>;

function readCompanion(value: ChildProfileCompanionRecord | null): ChildProfileCompanion | null {
  return value === null ? null : CHILD_PROFILE_COMPANION_BY_RECORD[value];
}

function writeCompanion(value: ChildProfileCompanion | null): ChildProfileCompanionRecord | null {
  return value === null ? null : CHILD_PROFILE_COMPANION_RECORD[value];
}

export function toChildProfile(record: ChildProfileRecord): ChildProfile {
  return {
    id: toChildProfileId(record.id),
    tenantId: toTenantId(record.tenantId),
    displayName: record.displayName,
    federalState: CHILD_PROFILE_FEDERAL_STATE_BY_RECORD[record.federalState],
    grade: record.grade,
    companion: readCompanion(record.companion),
    voiceConsent: record.voiceConsent,
    createdAt: instantToDate(record.createdAt),
    updatedAt: instantToDate(record.updatedAt),
  };
}

/** The columns written when a child profile is created. */
export interface ChildProfileCreateData {
  displayName: string;
  federalState: ChildProfileFederalStateRecord;
  grade: number;
  companion: ChildProfileCompanionRecord | null;
  voiceConsent: boolean;
}

export function toChildProfileCreateData(draft: ChildProfileDraft): ChildProfileCreateData {
  return {
    displayName: draft.displayName,
    federalState: CHILD_PROFILE_FEDERAL_STATE_RECORD[draft.federalState],
    grade: draft.grade,
    companion: writeCompanion(draft.companion),
    voiceConsent: draft.voiceConsent,
  };
}

/** The columns written on update. `updatedAt` is set here: Prisma 8 has no update hook. */
export interface ChildProfileUpdateData {
  displayName?: string;
  federalState?: ChildProfileFederalStateRecord;
  grade?: number;
  companion?: ChildProfileCompanionRecord | null;
  voiceConsent?: boolean;
  updatedAt: string;
}

type ChildProfileFieldUpdate1 = Pick<
  ChildProfileUpdateData,
  'displayName' | 'federalState' | 'grade' | 'companion' | 'voiceConsent'
>;

function toFieldUpdate1(changes: ChildProfileChanges): ChildProfileFieldUpdate1 {
  const data: ChildProfileFieldUpdate1 = {};
  if (changes.displayName !== undefined) {
    data.displayName = changes.displayName;
  }
  if (changes.federalState !== undefined) {
    data.federalState = CHILD_PROFILE_FEDERAL_STATE_RECORD[changes.federalState];
  }
  if (changes.grade !== undefined) {
    data.grade = changes.grade;
  }
  if (changes.companion !== undefined) {
    data.companion = writeCompanion(changes.companion);
  }
  if (changes.voiceConsent !== undefined) {
    data.voiceConsent = changes.voiceConsent;
  }
  return data;
}

export function toChildProfileUpdateData(
  changes: ChildProfileChanges,
  now: Date,
): ChildProfileUpdateData {
  return {
    ...toFieldUpdate1(changes),
    updatedAt: dateToInstant(now),
  };
}
