import type { CurriculumStoreOutcome } from './competency.repository';

/** What operations see about an ingest: the document key, version, outcome and counts only. */
export interface CurriculumEvent {
  readonly type: 'curriculum.document_ingested';
  readonly sourceKey: string;
  readonly version: string;
  readonly outcome: CurriculumStoreOutcome;
  readonly statementCount: number;
  readonly truncatedCount: number;
}

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface CurriculumAuditLog {
  record(event: CurriculumEvent): void;
}
