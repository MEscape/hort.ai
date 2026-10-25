import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCurriculumText } from '@modules/curriculum/domain/parsing/parse-curriculum-text';
import { rankTexts } from '@modules/curriculum/domain/retrieval/rank-texts';

/**
 * The five sample tasks of the MVP scope (#5, docs/product/mvp-scope.md) against the real Hessian
 * and KMK statements in `prisma/curriculum`: each must ground in the area the scope names.
 */
function load(file: string) {
  const raw = readFileSync(join(process.cwd(), 'prisma/curriculum', file), 'utf8');
  return parseCurriculumText(raw)
    ._unsafeUnwrap()
    .statements.map((statement) => ({
      ...statement,
      code: `${file}:${statement.code}`,
    }));
}

const hessen = load('he-kc-mathematik-primarstufe.curriculum.txt');
const kmk = load('kmk-bista-mathematik-primarbereich.curriculum.txt');

const SAMPLES = [
  {
    id: 'S1',
    task: 'Lisa hat 36 Murmeln. Sie verteilt sie gerecht an 4 Kinder. Wie viele Murmeln bekommt jedes Kind?',
    expect: /Division|Sach|Grundrechenarten/,
  },
  { id: 'S2', task: 'Rechne: 347 + 256', expect: /Addition|Rechen/ },
  {
    id: 'S3',
    task: 'Ein Heft kostet 2 € 50 ct. Tim kauft 3 Hefte. Wie viel muss er bezahlen?',
    expect: /Geldwert/,
  },
  {
    id: 'S4',
    task: 'Der Film beginnt um 15:45 Uhr und dauert 50 Minuten. Wann ist er zu Ende?',
    expect: /Zeitspannen|Dauer/,
  },
  {
    id: 'S5',
    task: 'Setze die Zahlenfolge fort: 4, 8, 12, 16, __, __',
    expect: /Muster|Zahlenfolgen/,
  },
];

describe('retrieval for the MVP sample tasks', () => {
  for (const [name, statements] of [
    ['Hessen', hessen],
    ['KMK fallback', kmk],
  ] as const) {
    for (const sample of SAMPLES) {
      it(`${name} ${sample.id}: the top three include the expected area`, () => {
        const ranked = rankTexts({ task: sample.task, subject: 'math', limit: 3 }, statements);
        expect(ranked.length).toBeGreaterThan(0);
        const joined = ranked.map(({ item }) => `${item.section} ${item.text}`).join(' | ');
        expect(joined).toMatch(sample.expect);
      });
    }
  }

  it('returns nothing for a task without any mathematical signal', () => {
    expect(
      rankTexts({ task: 'Hallo, wie geht es dir heute?', subject: 'math', limit: 3 }, hessen),
    ).toEqual([]);
  });

  it('never returns more than the limit', () => {
    expect(
      rankTexts({ task: SAMPLES[0]?.task ?? '', subject: 'math', limit: 2 }, kmk).length,
    ).toBeLessThanOrEqual(2);
  });
});
