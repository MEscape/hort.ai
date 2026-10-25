/**
 * Server-side public API of the curriculum module (#28): ingest official curriculum texts into
 * versioned competencies and retrieve the ones relevant to a child's task. See
 * docs/architecture/curriculum.md for the source format and the untrusted-data contract (#10).
 */

export { curriculumCommands, curriculumQueries, curriculumText } from './composition';

export type { RelevantCompetenciesRequest } from './application/contracts/curriculum-inputs';
export type {
  CurriculumIngestReport,
  RelevantCompetenciesView,
  RelevantCompetencyView,
} from './application/contracts/curriculum-views';
export {
  CURRICULUM_ERROR_CODES,
  CURRICULUM_VALIDATION_CODES,
} from './domain/errors/curriculum-errors';
