import { curriculumQueries } from '@modules/curriculum';

import type { CompetencyRetrieval } from '../../domain/ports/competency-retrieval.port';

/**
 * Asks the curriculum module for the competencies of the child's state, grade and subject (or the
 * KMK standards where the state has none). Only the code and the text cross back.
 */
export const curriculumCompetencyRetrieval: CompetencyRetrieval = {
  findFor: (query) =>
    curriculumQueries.findRelevantCompetencies
      .execute(query)
      .map(({ competencies }) =>
        competencies.map(({ code, text }) => ({ code, description: text })),
      ),
};
