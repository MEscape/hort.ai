import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseCurriculumText } from '../../domain/parsing/parse-curriculum-text';

import type { CurriculumIngestReport } from '../contracts/curriculum-views';
import type { CurriculumDependencies } from '../curriculum-dependencies';

/**
 * Ingests one official curriculum source text (#28): parses its header and statements, bounds
 * every statement, and stores exactly that document version. Idempotent: the same text again
 * reports `unchanged`; a new version is stored next to the old one and retrieval uses the newest.
 * A new federal state is a new source text, never a code change.
 *
 * @authorization system Run by an operator from the command line (`npm run curriculum:ingest`) or the development seed; no request and no actor are involved.
 * @rate-limit none Not reachable from any request; only the operator's script and the seed call it.
 */
export class IngestCurriculumDocument {
  constructor(private readonly deps: CurriculumDependencies) {}

  execute(
    rawText: string,
  ): AppResultAsync<CurriculumIngestReport, ValidationAppError | InfrastructureAppError> {
    const parsed = parseCurriculumText(rawText);
    if (parsed.isErr()) {
      return errAsync(parsed.error);
    }
    const draft = parsed.value;
    const { audit, competencies } = this.deps;

    return competencies.saveDocument(draft).map((outcome) => {
      const report: CurriculumIngestReport = {
        sourceKey: draft.source.sourceKey,
        version: draft.source.version,
        outcome,
        statementCount: draft.statements.length,
        truncatedCount: draft.statements.filter((statement) => statement.truncated).length,
      };
      audit.record({ type: 'curriculum.document_ingested', ...report });
      return report;
    });
  }
}
