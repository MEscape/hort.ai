import type {
  CurriculumFederalState,
  CurriculumOrigin,
  CurriculumSubject,
} from './curriculum-scope';

/**
 * Where one text came from. `federalState` null means "valid in every state" (the KMK standards,
 * the fallback for a state without an ingested curriculum). A new state or document is a new
 * source text with this header, never a code change.
 */
export interface CurriculumSource {
  readonly origin: CurriculumOrigin;
  readonly sourceKey: string;
  readonly version: string;
  readonly title: string;
  readonly federalState: CurriculumFederalState | null;
  readonly subject: CurriculumSubject;
  readonly gradeFrom: number;
  readonly gradeTo: number;
  readonly sourceUrl: string | null;
}

/** One short statement extracted from a source text, with its place in the document. */
export interface CompetencyStatement {
  /** Stable within the document version (`s<section>-<item>`), so a re-run hits the same rows. */
  readonly code: string;
  readonly text: string;
  readonly section: string;
  readonly page: number | null;
  /** The statement was longer than the limit and was cut. */
  readonly truncated: boolean;
}

/** A source and the statements extracted from it: what the ingest stores. */
export interface CurriculumDocumentDraft {
  readonly source: CurriculumSource;
  readonly statements: readonly CompetencyStatement[];
}

/** A stored competency of an official document, with everything needed to cite it. */
export interface Competency {
  readonly code: string;
  readonly text: string;
  readonly section: string;
  readonly page: number | null;
  readonly federalState: CurriculumFederalState | null;
  readonly subject: CurriculumSubject;
  readonly gradeFrom: number;
  readonly gradeTo: number;
  readonly document: {
    readonly sourceKey: string;
    readonly version: string;
    readonly title: string;
    readonly sourceUrl: string | null;
    readonly createdAt: Date;
  };
}

/**
 * A section of a teacher's material (#29), already bound to one class. #28 only defines the shape so
 * retrieval can rank it next to the official competencies.
 */
export interface TeacherMaterialStatement {
  readonly code: string;
  readonly text: string;
  readonly section: string | null;
  readonly page: number | null;
  readonly materialId: string;
  readonly materialTitle: string;
}
