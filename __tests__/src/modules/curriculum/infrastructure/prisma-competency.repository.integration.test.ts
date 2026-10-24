// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CurriculumDocumentDraft } from '@modules/curriculum/domain/models/competency';
import type { CompetencyRepository } from '@modules/curriculum/domain/ports/competency.repository';

import type { db as Db } from '@lib/db';

/**
 * The Prisma adapter against the real `CurriculumDocument` and `Competency` tables (local Postgres
 * after `npm run db:migrate`; CI migrates its own). Skipped without `DATABASE_URL`. Every document
 * carries a source key of this run and is removed afterwards.
 */
const isEnabled = Boolean(process.env['DATABASE_URL']);

describe.skipIf(!isEnabled)('PrismaCompetencyRepository against Postgres', () => {
  const runId = `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const stateKey = `${runId}-state`;
  const fallbackKey = `${runId}-all`;

  let repository: CompetencyRepository;
  let db: typeof Db;
  let disconnect: () => Promise<void>;

  function draft(
    sourceKey: string,
    version: string,
    federalState: 'sl' | null,
    texts: readonly string[],
  ): CurriculumDocumentDraft {
    return {
      source: {
        origin: 'official',
        sourceKey,
        version,
        title: `Test ${sourceKey}`,
        federalState,
        subject: 'english',
        gradeFrom: 1,
        gradeTo: 2,
        sourceUrl: 'https://example.org/test.pdf',
      },
      statements: texts.map((text, index) => ({
        code: `s01-0${index + 1}`,
        text,
        section: 'Abschnitt',
        page: 3,
        truncated: false,
      })),
    };
  }

  async function ours(federalState: 'sl' | null) {
    const result = await repository.listCandidates(
      { federalState, subject: 'english', grade: 1 },
      500,
    );
    return result
      ._unsafeUnwrap()
      .filter((competency) => competency.document.sourceKey.startsWith(runId));
  }

  beforeAll(async () => {
    const database = await import('@lib/db');
    const { PrismaCompetencyRepository } =
      await import('@modules/curriculum/infrastructure/prisma/prisma-competency.repository');
    db = database.db;
    disconnect = database.disconnectDb;
    repository = new PrismaCompetencyRepository();
  });

  afterAll(async () => {
    for (const sourceKey of [stateKey, fallbackKey]) {
      await db.orm.public.CurriculumDocument.where({ sourceKey }).deleteAndCount();
    }
    await disconnect();
  });

  it('stores a document idempotently and loads it back with its source', async () => {
    const first = draft(stateKey, 'v1', 'sl', ['Wörter verstehen', 'Sätze lesen']);
    expect((await repository.saveDocument(first))._unsafeUnwrap()).toBe('created');
    expect((await repository.saveDocument(first))._unsafeUnwrap()).toBe('unchanged');

    const loaded = await ours('sl');
    expect(loaded.map((c) => [c.code, c.text, c.section, c.page])).toEqual([
      ['s01-01', 'Wörter verstehen', 'Abschnitt', 3],
      ['s01-02', 'Sätze lesen', 'Abschnitt', 3],
    ]);
    expect(loaded[0]).toMatchObject({
      federalState: 'sl',
      subject: 'english',
      gradeFrom: 1,
      gradeTo: 2,
      document: { sourceKey: stateKey, version: 'v1', sourceUrl: 'https://example.org/test.pdf' },
    });
  });

  it('replaces the statements of a changed version and reads only the newest version', async () => {
    expect(
      (
        await repository.saveDocument(draft(stateKey, 'v1', 'sl', ['Nur noch eine Aussage']))
      )._unsafeUnwrap(),
    ).toBe('updated');
    expect((await ours('sl')).map((c) => c.text)).toEqual(['Nur noch eine Aussage']);

    expect(
      (
        await repository.saveDocument(draft(stateKey, 'v2', 'sl', ['Neue Fassung']))
      )._unsafeUnwrap(),
    ).toBe('created');
    expect((await ours('sl')).map((c) => [c.document.version, c.text])).toEqual([
      ['v2', 'Neue Fassung'],
    ]);
  });

  it('keeps state documents and documents valid everywhere apart', async () => {
    await repository.saveDocument(draft(fallbackKey, '1', null, ['Für alle Länder']));
    expect((await ours(null)).map((c) => c.text)).toEqual(['Für alle Länder']);
    expect((await ours('sl')).map((c) => c.document.sourceKey)).not.toContain(fallbackKey);
    const otherGrade = await repository.listCandidates(
      { federalState: 'sl', subject: 'english', grade: 4 },
      500,
    );
    expect(
      otherGrade._unsafeUnwrap().filter((c) => c.document.sourceKey.startsWith(runId)),
    ).toEqual([]);
  });
});
