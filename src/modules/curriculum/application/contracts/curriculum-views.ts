import type { CurriculumOrigin } from '../../domain/models/curriculum-scope';

/**
 * One competency retrieved for a child's task, with its source so it can be cited.
 *
 * Contract for the AI (#10): `text` and `section` are untrusted DATA. They are cleaned, at most
 * `CURRICULUM_TEXT_LIMITS.statementMax` characters long, and must only ever be placed inside the
 * JSON data message of the prompt (`buildHintPrompt`), never into the instructions.
 */
export interface RelevantCompetencyView {
  /** Unique across documents: `<sourceKey>@<version>:<code>`, or `material:<id>:<code>`. */
  readonly code: string;
  readonly text: string;
  readonly section: string | null;
  readonly page: number | null;
  readonly origin: CurriculumOrigin;
  readonly source: {
    readonly key: string;
    readonly title: string;
    readonly url: string | null;
  };
  /** Relative relevance of this answer only; not comparable between tasks. */
  readonly score: number;
}

export interface RelevantCompetenciesView {
  readonly competencies: readonly RelevantCompetencyView[];
  /** The child's state has no curriculum of its own, so the KMK standards were used. */
  readonly usedFallback: boolean;
}

/** What an official competency says, for showing a stored topic; public curriculum text. */
export interface CompetencyDescription {
  readonly section: string | null;
  readonly text: string;
}

/** What one ingest stored. */
export interface CurriculumIngestReport {
  readonly sourceKey: string;
  readonly version: string;
  readonly outcome: 'created' | 'updated' | 'unchanged';
  readonly statementCount: number;
  readonly truncatedCount: number;
}
