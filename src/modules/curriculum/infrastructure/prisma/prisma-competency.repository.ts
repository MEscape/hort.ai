import { db, createPersistenceFailures, instantToDate } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import { CURRICULUM_ERROR_CODES } from '../../domain/errors/curriculum-errors';

import {
  COMPETENCY_SELECT,
  CURRICULUM_DOCUMENT_SELECT,
  DOCUMENT_METADATA_FIELDS,
  sameMetadata,
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
  CompetencyText,
  CompetencyTextLookup,
  CurriculumStoreOutcome,
} from '../../domain/ports/competency.repository';

const failures = createPersistenceFailures({
  module: 'curriculum.persistence',
  code: CURRICULUM_ERROR_CODES.persistenceFailed,
  subject: 'Competency',
});

/** Upper bound of document versions read per lookup; far above any real curriculum history. */
const DOCUMENTS_MAX = 200;

/** `2022` > `2011`, `v10` > `v9`; an equal version (never stored twice) falls back to ingest time. */
function isNewer(document: CurriculumDocumentRecord, current: CurriculumDocumentRecord): boolean {
  const byVersion = document.version.localeCompare(current.version, 'en', { numeric: true });
  if (byVersion !== 0) {
    return byVersion > 0;
  }
  return instantToDate(document.createdAt).getTime() > instantToDate(current.createdAt).getTime();
}

/** The newest version of each source by its version, not by when it was ingested. */
function newestPerSource(
  documents: readonly CurriculumDocumentRecord[],
): CurriculumDocumentRecord[] {
  const newest = new Map<string, CurriculumDocumentRecord>();
  for (const document of documents) {
    const current = newest.get(document.sourceKey);
    if (!current || isNewer(document, current)) {
      newest.set(document.sourceKey, document);
    }
  }
  return [...newest.values()];
}

/**
 * Prisma 8 repository for official curriculum documents and competencies. Curriculum text is
 * public and belongs to no tenant, so queries are scoped by state, subject and grade, not owner.
 */
export class PrismaCompetencyRepository implements CompetencyRepository, CompetencyTextLookup {
  saveDocument(
    draft: CurriculumDocumentDraft,
  ): AppResultAsync<CurriculumStoreOutcome, InfrastructureAppError> {
    const { source, statements } = draft;
    return fromThrowableAsync(
      async () =>
        db.transaction(async (tx) => {
          const documents = tx.orm.public.CurriculumDocument;
          const competencies = tx.orm.public.Competency;
          const metadata = toDocumentCreateData(source);
          const existing = await documents
            .select('id', ...DOCUMENT_METADATA_FIELDS)
            .where({ sourceKey: source.sourceKey, version: source.version })
            .first();
          const documentId = existing?.id ?? (await documents.create(metadata)).id;

          if (existing && !sameMetadata(existing, metadata)) {
            // Title, URL or scope changed: the document and its statements' scope follow.
            await documents.where({ id: documentId }).update(metadata);
            await competencies.where({ documentId }).deleteAndCount();
          } else if (existing) {
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
        await (
          federalState === null
            ? matching.where((row) => row.federalState.isNull())
            : matching.where({ federalState: toFederalStateRecord(federalState) })
        )
          .limit(DOCUMENTS_MAX)
          .all(),
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

  describe(
    refs: Parameters<CompetencyTextLookup['describe']>[0],
    limit: number,
  ): AppResultAsync<readonly CompetencyText[], InfrastructureAppError> {
    if (refs.length === 0) {
      return okAsync([]);
    }
    return fromThrowableAsync(async () => {
      const documents = await db.orm.public.CurriculumDocument.select('id', 'sourceKey', 'version')
        .where((row) => row.sourceKey.in(unique(refs.map(({ sourceKey }) => sourceKey))))
        .limit(DOCUMENTS_MAX)
        .all();
      const wanted = documents.filter((document) =>
        refs.some(
          (ref) => ref.sourceKey === document.sourceKey && ref.version === document.version,
        ),
      );
      if (wanted.length === 0) {
        return [];
      }
      const byId = new Map(wanted.map((document) => [document.id, document]));
      const records = await db.orm.public.Competency.select('documentId', 'code', 'text')
        .where((row) => row.documentId.in([...byId.keys()]))
        .where((row) => row.code.in(unique(refs.map(({ code }) => code))))
        .limit(limit)
        .all();
      return records.flatMap((record) => {
        const document = byId.get(record.documentId);
        return document
          ? [
              {
                sourceKey: document.sourceKey,
                version: document.version,
                code: record.code,
                text: record.text,
              },
            ]
          : [];
      });
    }, failures.infraOnly('describe'));
  }
}
