import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { CompetencyTextLookup } from '../../domain/ports/competency.repository';
import type { CompetencyDescriptionView } from '../contracts/curriculum-views';

/** At most this many codes per call; a summary names about ten sessions. */
const DESCRIBE_MAX = 20;
const CODE_MAX_LENGTH = 300;
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
  constructor(private readonly deps: { readonly texts: CompetencyTextLookup }) {}

  execute(
    codes: readonly string[],
  ): AppResultAsync<readonly CompetencyDescriptionView[], InfrastructureAppError> {
    const refs = codes
      .filter((code) => code.length <= CODE_MAX_LENGTH)
      .slice(0, DESCRIBE_MAX)
      .flatMap((code) => {
        const match = OFFICIAL_CODE.exec(code);
        return match?.[1] === undefined || match[2] === undefined || match[3] === undefined
          ? []
          : [{ sourceKey: match[1], version: match[2], code: match[3] }];
      });
    return this.deps.texts.describe(refs, DESCRIBE_MAX).map((found) =>
      found.map(({ sourceKey, version, code, text }) => ({
        code: `${sourceKey}@${version}:${code}`,
        text,
      })),
    );
  }
}
