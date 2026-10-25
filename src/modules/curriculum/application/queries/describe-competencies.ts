import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { COMPETENCY_CODE_MAX_LENGTH, COMPETENCY_DESCRIPTIONS_MAX } from '../curriculum-limits';

import type { CompetencyTextDependencies } from '../competency-text-dependencies';
import type { CompetencyDescriptionView } from '../contracts/curriculum-views';

/** `<sourceKey>@<version>:<code>`, the code a retrieval answers with (`fromCompetency`). */
const OFFICIAL_CODE = /^([^@:]+)@([^:]+):(.+)$/u;

/**
 * The texts of official competencies by the code retrieval gave them, for naming the topic of a
 * help session in a summary (#35). A teacher's material code (`material:…`) or an unknown code is
 * simply left out, so the caller falls back to another name.
 *
 * @authorization system Called server-side by the guidance summary after it authorized the parent on their own child; the result is public curriculum text, never personal data.
 * @rate-limit none A bounded read of a few public rows, inside a page load that is itself authorized.
 */
export class DescribeCompetencies {
  constructor(private readonly deps: CompetencyTextDependencies) {}

  execute(
    codes: readonly string[],
  ): AppResultAsync<readonly CompetencyDescriptionView[], InfrastructureAppError> {
    const refs = codes
      .filter((code) => code.length <= COMPETENCY_CODE_MAX_LENGTH)
      .slice(0, COMPETENCY_DESCRIPTIONS_MAX)
      .flatMap((code) => {
        const match = OFFICIAL_CODE.exec(code);
        return match?.[1] === undefined || match[2] === undefined || match[3] === undefined
          ? []
          : [{ sourceKey: match[1], version: match[2], code: match[3] }];
      });
    return this.deps.texts.describe(refs, COMPETENCY_DESCRIPTIONS_MAX).map((found) =>
      found.map(({ sourceKey, version, code, text }) => ({
        code: `${sourceKey}@${version}:${code}`,
        text,
      })),
    );
  }
}
