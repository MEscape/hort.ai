import { describe, expect, it, vi } from 'vitest';

import type { CurriculumDependencies } from '@modules/curriculum/application/curriculum-dependencies';
import { DescribeCompetencies } from '@modules/curriculum/application/queries/describe-competencies';
import type { Competency } from '@modules/curriculum/domain/models/competency';
import type { CompetencyRef } from '@modules/curriculum/domain/ports/competency.repository';

import { okAsync } from '@lib/result';

const ADDITION: Competency = {
  code: 's01-01',
  text: 'Addieren im Zahlenraum bis 100',
  section: 'Zahlen und Operationen',
  page: 12,
  federalState: 'by',
  subject: 'math',
  gradeFrom: 1,
  gradeTo: 2,
  document: {
    sourceKey: 'by-math',
    version: '2014',
    title: 'LehrplanPLUS',
    sourceUrl: null,
    createdAt: new Date('2026-10-24T00:00:00Z'),
  },
};

function deps() {
  const findByCodes = vi.fn((_refs: readonly CompetencyRef[]) => okAsync([ADDITION]));
  const dependencies: CurriculumDependencies = {
    competencies: {
      listCandidates: () => okAsync([]),
      saveDocument: () => okAsync('created' as const),
      findByCodes,
    },
    teacherMaterial: { listForClassroom: () => okAsync([]) },
    audit: { record: vi.fn() },
  };
  return { dependencies, findByCodes };
}

describe('DescribeCompetencies', () => {
  it('describes each official competency by its full view code', async () => {
    const { dependencies, findByCodes } = deps();
    const result = await new DescribeCompetencies(dependencies).execute([
      'by-math@2014:s01-01',
      'by-math@2014:s01-01',
    ]);
    expect(result._unsafeUnwrap()).toEqual(
      new Map([
        ['by-math@2014:s01-01', { section: 'Zahlen und Operationen', text: ADDITION.text }],
      ]),
    );
    expect(findByCodes).toHaveBeenCalledWith([
      { sourceKey: 'by-math', version: '2014', code: 's01-01' },
    ]);
  });

  it('skips teacher material and malformed codes without a lookup', async () => {
    const { dependencies, findByCodes } = deps();
    const result = await new DescribeCompetencies(dependencies).execute([
      'material:m1:s00-01',
      'no-version',
      '@2014:x',
      'by-math@:x',
      'by-math@2014:',
    ]);
    expect(result._unsafeUnwrap().size).toBe(0);
    expect(findByCodes).not.toHaveBeenCalled();
  });

  it('looks up at most the bounded number of codes', async () => {
    const { dependencies, findByCodes } = deps();
    const codes = Array.from({ length: 500 }, (_, index) => `by-math@2014:c${String(index)}`);
    await new DescribeCompetencies(dependencies).execute(codes);
    expect(findByCodes.mock.calls[0]?.[0].length).toBe(100);
  });
});
