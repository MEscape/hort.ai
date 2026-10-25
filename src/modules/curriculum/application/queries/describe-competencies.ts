import type { InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { isDefined, unique } from '@lib/utils';

import { DESCRIBED_CODES_MAX } from '../curriculum-limits';
import { competencyViewCode, parseCompetencyViewCode } from '../curriculum-view-mappers';

import type { CompetencyDescription } from '../contracts/curriculum-views';
import type { CurriculumDependencies } from '../curriculum-dependencies';

/**
 * Section and statement of the official competencies that stored view codes name, so another
 * module (the parent summary) can show a topic without knowing the curriculum's code format.
 * Teacher material and malformed codes are left out; an unknown code is simply missing.
 *
 * @authorization system Public curriculum text, never personal data; the caller has already authorized whose codes it holds.
 * @rate-limit none A bounded read of at most `DESCRIBED_CODES_MAX` public rows, inside a request the caller authorizes.
 */
export class DescribeCompetencies {
  constructor(private readonly deps: CurriculumDependencies) {}

  execute(
    viewCodes: readonly string[],
  ): AppResultAsync<ReadonlyMap<string, CompetencyDescription>, InfrastructureAppError> {
    const refs = unique(viewCodes)
      .slice(0, DESCRIBED_CODES_MAX)
      .map(parseCompetencyViewCode)
      .filter(isDefined);
    if (refs.length === 0) {
      return okAsync(new Map());
    }
    return this.deps.competencies
      .findByCodes(refs)
      .map(
        (competencies) =>
          new Map(
            competencies.map((competency) => [
              competencyViewCode(competency),
              { section: competency.section, text: competency.text },
            ]),
          ),
      );
  }
}
