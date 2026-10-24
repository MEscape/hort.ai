import { db, createPersistenceFailures, instantToDate } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { CURRICULUM_ERROR_CODES } from '../../domain/errors/curriculum-errors';

import {
  COMPETENCY_SELECT,
  CURRICULUM_DOCUMENT_SELECT,
  sameStatement,
  toCompetency,
  toCompetencyCreateData,
  toDocumentCreateData,
  toFederalStateRecord,
  toSubjectRecord,
} from './competency-record-mapper';

import type { CurriculumDocumentRecord } from './competency-record-mapper';
import type { Competency, CurriculumDocumentDraft } from '../../domain/models/competency';
import type {
  CompetencyFilter,
  CompetencyRepository,
  CurriculumStoreOutcome,
} from '../../domain/ports/competency.repository';

const failures = createPersistenceFailures({
  module: 'curriculum.persistence',
  code: CURRICULUM_ERROR_CODES.persistenceFailed,
  subject: 'Competency',
});

/** The newest version of each source, judged by when it was ingested. */
function newestPerSource(
  documents: readonly CurriculumDocumentRecord[],
): CurriculumDocumentRecord[] {
  const newest = new Map<string, CurriculumDocumentRecord>();
  for (const document of documents) {
    const current = newest.get(document.sourceKey);
    if (
      !current ||
      instantToDate(document.createdAt).getTime() > instantToDate(current.createdAt).getTime()
    ) {
      newest.set(document.sourceKey, document);
    }
  }
  return [...newest.values()];
}

/**
 * Prisma 8 repository for official curriculum documents and competencies. Curriculum text is
 * public and belongs to no tenant, so queries are scoped by state, subject and grade, not owner.
 */
export class PrismaCompetencyRepository implements CompetencyRepository {
  saveDocument(
    draft: CurriculumDocumentDraft,
  ): AppResultAsync<CurriculumStoreOutcome, InfrastructureAppError> {
    const { source, statements } = draft;
    return fromThrowableAsync(
      async () =>
        db.transaction(async (tx) => {
          const documents = tx.orm.public.CurriculumDocument;
          const competencies = tx.orm.public.Competency;
          const existing = await documents
            .select('id')
            .where({ sourceKey: source.sourceKey, version: source.version })
            .first();
          const documentId =
            existing?.id ?? (await documents.create(toDocumentCreateData(source))).id;

          if (existing) {
            const stored = await competencies
              .select(...COMPETENCY_SELECT)
              .where({ documentId })
              .orderBy((row) => row.code.asc())
              .all();
            const ordered = [...statements].sort((a, b) => a.code.localeCompare(b.code));
            if (
              stored.length === ordered.length &&
              stored.every((record, index) => {
                const statement = ordered[index];
                return statement !== undefined && sameStatement(record, statement);
              })
            ) {
              return 'unchanged' as const;
            }
            await competencies.where({ documentId }).deleteAndCount();
          }
          await competencies.createAll(
            statements.map((statement) => toCompetencyCreateData(documentId, source, statement)),
          );
          return existing ? ('updated' as const) : ('created' as const);
        }),
      failures.infraOnly('saveDocument'),
    );
  }

  listCandidates(
    filter: CompetencyFilter,
    limit: number,
  ): AppResultAsync<readonly Competency[], InfrastructureAppError> {
    const { federalState, subject, grade } = filter;
    return fromThrowableAsync(async () => {
      const matching = db.orm.public.CurriculumDocument.select(...CURRICULUM_DOCUMENT_SELECT)
        .where({ subject: toSubjectRecord(subject) })
        .where((row) => row.gradeFrom.lte(grade))
        .where((row) => row.gradeTo.gte(grade));
      const documents = newestPerSource(
        await (federalState === null
          ? matching.where((row) => row.federalState.isNull())
          : matching.where({ federalState: toFederalStateRecord(federalState) })
        ).all(),
      );
      if (documents.length === 0) {
        return [];
      }
      const byId = new Map(documents.map((document) => [document.id, document]));
      const records = await db.orm.public.Competency.select(...COMPETENCY_SELECT)
        .where((row) => row.documentId.in([...byId.keys()]))
        .orderBy([(row) => row.documentId.asc(), (row) => row.code.asc()])
        .limit(limit)
        .all();
      return records.flatMap((record) => {
        const document = byId.get(record.documentId);
        return document ? [toCompetency(record, document)] : [];
      });
    }, failures.infraOnly('listCandidates'));
  }
}
