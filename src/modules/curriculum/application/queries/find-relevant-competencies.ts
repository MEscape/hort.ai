import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { rankTexts } from '../../domain/retrieval/rank-texts';
import { toRelevantCompetencyView } from '../curriculum-view-mappers';
import { loadGroundingCandidates } from '../services/load-grounding-candidates';
import { parseRelevanceQuery } from '../services/parse-relevance-query';

import type { RelevantCompetenciesRequest } from '../contracts/curriculum-inputs';
import type { RelevantCompetenciesView } from '../contracts/curriculum-views';
import type { CurriculumDependencies } from '../curriculum-dependencies';

/**
 * The competencies most relevant to a child's task (#28), for grounding a hint (#10): the
 * curriculum of the child's state and grade, or the KMK standards when the state has none, plus
 * the material of the child's own class (#29). Ranked by weighted term overlap, at most five.
 *
 * @authorization system Called server-side by the hint flow after it has authorized the child's profile; it passes that profile's state and grade, and the result is public curriculum text, never personal data.
 * @rate-limit none Pure reads of a few dozen public rows; it runs only inside the hint flow, which carries the rate limit of the child's request.
 */
export class FindRelevantCompetencies {
  constructor(private readonly deps: CurriculumDependencies) {}

  execute(
    request: RelevantCompetenciesRequest,
  ): AppResultAsync<RelevantCompetenciesView, ValidationAppError | InfrastructureAppError> {
    const parsed = parseRelevanceQuery(request);
    if (parsed.isErr()) {
      return errAsync(parsed.error);
    }
    const query = parsed.value;
    return loadGroundingCandidates(this.deps, query).map(({ candidates, usedFallback }) => ({
      competencies: rankTexts(query, candidates).map(toRelevantCompetencyView),
      usedFallback,
    }));
  }
}
