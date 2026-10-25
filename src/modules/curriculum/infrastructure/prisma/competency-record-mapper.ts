import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';

import type {
  Competency,
  CompetencyStatement,
  CurriculumSource,
} from '../../domain/models/competency';
import type {
  CurriculumFederalState,
  CurriculumSubject,
} from '../../domain/models/curriculum-scope';

/** Persistence shapes. Generated Prisma contract types never leave the persistence layer. */

const FEDERAL_STATE_RECORD = {
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
} as const satisfies Record<CurriculumFederalState, string>;

type FederalStateRecord = (typeof FEDERAL_STATE_RECORD)[CurriculumFederalState];

const FEDERAL_STATE_BY_RECORD = Object.fromEntries(
  Object.entries(FEDERAL_STATE_RECORD).map(([domain, record]) => [record, domain]),
) as Record<FederalStateRecord, CurriculumFederalState>;

const SUBJECT_RECORD = {
  math: 'MATH',
  german: 'GERMAN',
  general_studies: 'GENERAL_STUDIES',
  english: 'ENGLISH',
} as const satisfies Record<CurriculumSubject, string>;

type SubjectRecord = (typeof SUBJECT_RECORD)[CurriculumSubject];

const SUBJECT_BY_RECORD = Object.fromEntries(
  Object.entries(SUBJECT_RECORD).map(([domain, record]) => [record, domain]),
) as Record<SubjectRecord, CurriculumSubject>;

export function toFederalStateRecord(state: CurriculumFederalState): FederalStateRecord {
  return FEDERAL_STATE_RECORD[state];
}

export function toSubjectRecord(subject: CurriculumSubject): SubjectRecord {
  return SUBJECT_RECORD[subject];
}

export interface CurriculumDocumentRecord {
  readonly id: string;
  readonly sourceKey: string;
  readonly version: string;
  readonly title: string;
  readonly sourceUrl: string | null;
  readonly createdAt: InstantRecord;
}

export const CURRICULUM_DOCUMENT_SELECT = [
  'id',
  'sourceKey',
  'version',
  'title',
  'sourceUrl',
  'createdAt',
] as const satisfies ReadonlyArray<keyof CurriculumDocumentRecord>;

export interface CompetencyRecord {
  readonly documentId: string;
  readonly code: string;
  readonly federalState: FederalStateRecord | null;
  readonly subject: SubjectRecord;
  readonly gradeFrom: number;
  readonly gradeTo: number;
  readonly text: string;
  readonly section: string;
  readonly page: number | null;
}

export const COMPETENCY_SELECT = [
  'documentId',
  'code',
  'federalState',
  'subject',
  'gradeFrom',
  'gradeTo',
  'text',
  'section',
  'page',
] as const satisfies ReadonlyArray<keyof CompetencyRecord>;

export function toDocumentCreateData(source: CurriculumSource) {
  return {
    sourceKey: source.sourceKey,
    version: source.version,
    title: source.title,
    federalState: source.federalState === null ? null : toFederalStateRecord(source.federalState),
    subject: toSubjectRecord(source.subject),
    gradeFrom: source.gradeFrom,
    gradeTo: source.gradeTo,
    sourceUrl: source.sourceUrl,
  };
}

export function toCompetencyCreateData(
  documentId: string,
  source: CurriculumSource,
  statement: CompetencyStatement,
) {
  return {
    documentId,
    code: statement.code,
    federalState: source.federalState === null ? null : toFederalStateRecord(source.federalState),
    subject: toSubjectRecord(source.subject),
    gradeFrom: source.gradeFrom,
    gradeTo: source.gradeTo,
    text: statement.text,
    section: statement.section,
    page: statement.page,
  };
}

/** The document fields an ingest may change under the same source key and version. */
export const DOCUMENT_METADATA_FIELDS = [
  'title',
  'federalState',
  'subject',
  'gradeFrom',
  'gradeTo',
  'sourceUrl',
] as const;

type DocumentMetadata = Omit<ReturnType<typeof toDocumentCreateData>, 'sourceKey' | 'version'>;

export function sameMetadata(stored: DocumentMetadata, next: DocumentMetadata): boolean {
  return DOCUMENT_METADATA_FIELDS.every((field) => stored[field] === next[field]);
}

/** A stored statement and a new one are the same when everything retrieval reads is the same. */
export function sameStatement(record: CompetencyRecord, statement: CompetencyStatement): boolean {
  return (
    record.code === statement.code &&
    record.text === statement.text &&
    record.section === statement.section &&
    record.page === statement.page
  );
}

export function toCompetency(
  record: CompetencyRecord,
  document: CurriculumDocumentRecord,
): Competency {
  return {
    code: record.code,
    text: record.text,
    section: record.section,
    page: record.page,
    federalState:
      record.federalState === null ? null : FEDERAL_STATE_BY_RECORD[record.federalState],
    subject: SUBJECT_BY_RECORD[record.subject],
    gradeFrom: record.gradeFrom,
    gradeTo: record.gradeTo,
    document: {
      sourceKey: document.sourceKey,
      version: document.version,
      title: document.title,
      sourceUrl: document.sourceUrl,
      createdAt: instantToDate(document.createdAt),
    },
  };
}
