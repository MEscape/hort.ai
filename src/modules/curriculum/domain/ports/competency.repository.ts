import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { Competency, CurriculumDocumentDraft } from '../models/competency';
import type { CurriculumFederalState, CurriculumSubject } from '../models/curriculum-scope';

/** What storing a document version did. */
export type CurriculumStoreOutcome = 'created' | 'updated' | 'unchanged';

/** Which competencies a child of one state and grade may be grounded in. */
export interface CompetencyFilter {
  /** `null` asks for the documents valid in every state (the KMK fallback). */
  readonly federalState: CurriculumFederalState | null;
  readonly subject: CurriculumSubject;
  readonly grade: number;
}

/**
 * Official curriculum documents and their competencies. The data is public curriculum text, not
 * owned by a tenant: there is nothing to scope by owner.
 */
export interface CompetencyRepository {
  /**
   * Stores one document version and exactly its statements, in one transaction. Keyed by
   * (sourceKey, version): a re-run with the same statements changes nothing, changed statements
   * replace the old ones of that version, and another version is a document of its own.
   */
  saveDocument(
    draft: CurriculumDocumentDraft,
  ): AppResultAsync<CurriculumStoreOutcome, InfrastructureAppError>;

  /**
   * The competencies matching the filter, of the newest version of each document. Bounded by
   * `limit` (performance.md); a curriculum slice has some dozens.
   */
  listCandidates(
    filter: CompetencyFilter,
    limit: number,
  ): AppResultAsync<readonly Competency[], InfrastructureAppError>;
}
