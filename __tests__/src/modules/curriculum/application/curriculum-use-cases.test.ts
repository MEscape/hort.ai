import { describe, expect, it, vi } from 'vitest';

import { IngestCurriculumDocument } from '@modules/curriculum/application/commands/ingest-curriculum-document';
import type { CurriculumDependencies } from '@modules/curriculum/application/curriculum-dependencies';
import { FindRelevantCompetencies } from '@modules/curriculum/application/queries/find-relevant-competencies';
import type {
  Competency,
  TeacherMaterialStatement,
} from '@modules/curriculum/domain/models/competency';
import type { CompetencyFilter } from '@modules/curriculum/domain/ports/competency.repository';

import { okAsync } from '@lib/result';

function competency(
  code: string,
  text: string,
  federalState: Competency['federalState'],
): Competency {
  return {
    code,
    text,
    section: 'Inhaltsfeld',
    page: 21,
    federalState,
    subject: 'math',
    gradeFrom: 3,
    gradeTo: 4,
    document: {
      sourceKey: federalState ? `${federalState}-doc` : 'kmk-doc',
      version: '1',
      title: 'Dokument',
      sourceUrl: null,
      createdAt: new Date('2026-10-24T00:00:00Z'),
    },
  };
}

const HE = [
  competency('s01-01', 'Grundrechenarten (Addition, Subtraktion, Multiplikation, Division)', 'he'),
  competency('s01-02', 'Orientierung im Raum', 'he'),
];
const KMK = [competency('s01-01', 'Rechnen mit Größen: Geldwerte und Zeitspannen', null)];
const MATERIAL: TeacherMaterialStatement = {
  code: 's00-01',
  text: 'Wir üben das gerechte Verteilen (Division) mit Murmeln.',
  section: null,
  page: 1,
  materialId: 'm1',
  materialTitle: 'Arbeitsblatt',
};

function deps() {
  const byState = (filter: CompetencyFilter): readonly Competency[] => {
    if (filter.federalState === null) {
      return KMK;
    }
    return filter.federalState === 'he' ? HE : [];
  };
  const listCandidates = vi.fn((filter: CompetencyFilter) => okAsync(byState(filter)));
  const listForClassroom = vi.fn(() => okAsync([MATERIAL]));
  const record = vi.fn();
  const saveDocument = vi.fn(() => okAsync('created' as const));
  const dependencies: CurriculumDependencies = {
    competencies: { listCandidates, saveDocument, findByCodes: () => okAsync([]) },
    teacherMaterial: { listForClassroom },
    audit: { record },
  };
  return { dependencies, listCandidates, listForClassroom, record, saveDocument };
}

const S1 =
  'Lisa hat 36 Murmeln. Sie verteilt sie gerecht an 4 Kinder. Wie viele bekommt jedes Kind?';

describe('FindRelevantCompetencies', () => {
  it("ranks the child's state curriculum and cites the source", async () => {
    const { dependencies, listForClassroom } = deps();
    const view = (
      await new FindRelevantCompetencies(dependencies).execute({
        federalState: 'he',
        grade: 3,
        subject: 'math',
        task: S1,
      })
    )._unsafeUnwrap();
    expect(view.usedFallback).toBe(false);
    expect(view.competencies[0]).toMatchObject({
      code: 'he-doc@1:s01-01',
      origin: 'official',
      page: 21,
      source: { key: 'he-doc', title: 'Dokument', url: null },
    });
    expect(view.competencies.map((c) => c.code)).not.toContain('he-doc@1:s01-02');
    expect(listForClassroom).not.toHaveBeenCalled();
  });

  it('falls back to the documents valid in every state', async () => {
    const { dependencies } = deps();
    const view = (
      await new FindRelevantCompetencies(dependencies).execute({
        federalState: 'by',
        grade: 4,
        subject: 'math',
        task: 'Ein Heft kostet 2 € 50 ct. Wie viel kosten 3 Hefte?',
      })
    )._unsafeUnwrap();
    expect(view.usedFallback).toBe(true);
    expect(view.competencies.map((c) => c.code)).toEqual(['kmk-doc@1:s01-01']);
  });

  it("adds material of the child's own class only, asking for exactly that class", async () => {
    const { dependencies, listForClassroom } = deps();
    const view = (
      await new FindRelevantCompetencies(dependencies).execute({
        federalState: 'he',
        grade: 3,
        subject: 'math',
        task: S1,
        classroomId: 'class-1',
        limit: 5,
      })
    )._unsafeUnwrap();
    expect(listForClassroom).toHaveBeenCalledWith('class-1', expect.any(Number), undefined);
    expect(view.competencies.map((c) => c.origin)).toContain('teacher-material');
  });

  it('caps the limit at five and rejects invalid input', async () => {
    const { dependencies, listCandidates } = deps();
    const query = new FindRelevantCompetencies(dependencies);
    const tooMany = await query.execute({
      federalState: 'he',
      grade: 3,
      subject: 'math',
      task: S1,
      limit: 99,
    });
    expect(tooMany._unsafeUnwrap().competencies.length).toBeLessThanOrEqual(5);
    for (const bad of [
      { federalState: 'xx', grade: 3 },
      { federalState: 'he', grade: 7 },
    ]) {
      const result = await query.execute({ ...bad, subject: 'math', task: S1 });
      expect(result.isErr()).toBe(true);
    }
    expect(listCandidates).toHaveBeenCalledTimes(1);
  });
});

describe('IngestCurriculumDocument', () => {
  const TEXT = [
    '---',
    'source-key: test-doc',
    'version: 1',
    'title: Test',
    'federal-state: he',
    'subject: math',
    'grades: 3-4',
    '---',
    '# A',
    '- eine Kompetenzaussage',
  ].join('\n');

  it('stores the parsed document and records counts only', async () => {
    const { dependencies, record, saveDocument } = deps();
    const report = (await new IngestCurriculumDocument(dependencies).execute(TEXT))._unsafeUnwrap();
    expect(report).toEqual({
      sourceKey: 'test-doc',
      version: '1',
      outcome: 'created',
      statementCount: 1,
      truncatedCount: 0,
    });
    expect(saveDocument).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledWith({ type: 'curriculum.document_ingested', ...report });
  });

  it('stores nothing for an invalid text', async () => {
    const { dependencies, saveDocument, record } = deps();
    const result = await new IngestCurriculumDocument(dependencies).execute('no header');
    expect(result.isErr()).toBe(true);
    expect(saveDocument).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});
