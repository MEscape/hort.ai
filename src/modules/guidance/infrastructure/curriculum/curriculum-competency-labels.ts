import { curriculumQueries } from '@modules/curriculum';

import type { CompetencyLabels } from '../../domain/ports/insight-sources.port';

/** The curriculum module's texts of official competencies, by the code a session stored (#35). */
export const curriculumCompetencyLabels: CompetencyLabels = {
  describe: (codes) =>
    curriculumQueries.describeCompetencies
      .execute(codes)
      .map((found) => new Map(found.map(({ code, text }) => [code, text]))),
};
