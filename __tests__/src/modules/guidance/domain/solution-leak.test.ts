import { describe, expect, it } from 'vitest';

import type { AiOutput, AssessmentResult } from '@modules/guidance/domain/ai-output/ai-output';
import { leaksSolution } from '@modules/guidance/domain/ai-output/solution-leak';
import type { SolutionContext } from '@modules/guidance/domain/ai-output/solution-leak';

const hint = (text: string): AiOutput => ({
  version: 1,
  kind: 'hint',
  hintLevel: 'next_step',
  text,
});

const assessment = (result: AssessmentResult, text: string): AiOutput => ({
  version: 1,
  kind: 'answer_assessment',
  hintLevel: 'next_step',
  result,
  text,
});

const praise = (text: string): AiOutput => ({
  version: 1,
  kind: 'praise',
  hintLevel: 'next_step',
  text,
});

const context = (task: string, extra: Partial<SolutionContext> = {}): SolutionContext => ({
  task,
  solutionKey: null,
  childAnswer: null,
  ...extra,
});

const CONTRACT_TASK = context('23 + 24 = ?');

describe('leaksSolution on the contract examples (docs/architecture/ai-output-contract.md)', () => {
  it.each([
    ['the final numeric result', hint('Das Ergebnis ist 47.')],
    ['a fully worked solution of the same problem', hint('20 + 20 = 40, 3 + 4 = 7, also 47.')],
    [
      'an assessment that reveals the expected answer',
      assessment('not_yet', 'Fast! Richtig wäre 47.'),
    ],
    ['a complete answer sentence for a text task', hint('Schreib: Tom hat 47 Murmeln.')],
  ])('rejects %s', (_case, output) => {
    expect(leaksSolution(output, CONTRACT_TASK)).toBe(true);
  });

  it.each([
    hint('Rechne zuerst die Zehner zusammen: Wie viel ist 20 + 20?'),
    hint('Welche Zahl gehört in die Lücke: 3 + __ = 7?'),
    assessment('not_yet', 'Die Zehner stimmen schon. Schau dir die Einer noch einmal an.'),
    hint('Beispiel: 34 + 13. Rechne erst die Zehner: 30 + 10 = 40, dann die Einer.'),
  ])('lets the valid example "$text" pass', (output) => {
    expect(leaksSolution(output, CONTRACT_TASK)).toBe(false);
  });
});

/** The sample tasks S1 to S5 of docs/product/mvp-scope.md, with their expected answers. */
describe.each([
  {
    name: 'S1 division in context',
    task: 'Lisa hat 36 Murmeln. Sie verteilt sie gerecht an 4 Kinder. Wie viele Murmeln bekommt jedes Kind?',
    leak: 'Jedes Kind bekommt 9 Murmeln.',
    safe: 'Beispiel: 20 Äpfel gerecht an 5 Kinder. 5 · 4 = 20, also bekommt jedes Kind 4 Äpfel. Probier es jetzt mit deinen Zahlen.',
  },
  {
    name: 'S2 addition up to 1000',
    task: 'Rechne: 347 + 256',
    leak: '300 + 200 = 500, 40 + 50 = 90, 7 + 6 = 13, zusammen 603.',
    safe: 'Beispiel: 125 + 132 = 100 + 100, 20 + 30, 5 + 2 → 200 + 50 + 7 = 257.',
  },
  {
    name: 'S3 money',
    task: 'Ein Heft kostet 2 € 50 ct. Tim kauft 3 Hefte. Wie viel muss er bezahlen?',
    leak: 'Tim muss 7,50 € bezahlen.',
    safe: 'Beispiel: 2 Stifte zu je 1 € 20 ct → 2 € und 40 ct = 2,40 €.',
  },
  {
    name: 'S4 time spans',
    task: 'Der Film beginnt um 15:45 Uhr und dauert 50 Minuten. Wann ist er zu Ende?',
    leak: 'Der Film ist um 16:35 Uhr zu Ende.',
    safe: 'Beispiel: Start 10:50, Dauer 30 Minuten: 10 Minuten bis 11:00, dann noch 20 → 11:20.',
  },
  {
    name: 'S5 patterns',
    task: 'Setze die Zahlenfolge fort: 4, 8, 12, 16, __, __',
    leak: 'Die nächsten Zahlen sind 20 und 24.',
    safe: 'Beispiel: 3, 6, 9 → immer +3, also 12, 15.',
  },
])('leaksSolution on $name', ({ task, leak, safe }) => {
  it('rejects a hint that states the answer', () => {
    expect(leaksSolution(hint(leak), context(task))).toBe(true);
  });

  it('lets the hint ladder example pass', () => {
    expect(leaksSolution(hint(safe), context(task))).toBe(false);
  });
});

describe('leaksSolution', () => {
  it.each(['36 : 4', '36 ÷ 4', '36:4', '36 / 4 = ?'])('computes the division in "%s"', (task) => {
    expect(leaksSolution(hint('Es kommt 9 heraus.'), context(task))).toBe(true);
  });

  it.each(['7 · 8', '7 x 8', '7 × 8', '7 * 8 = ?'])('computes the product in "%s"', (task) => {
    expect(leaksSolution(hint('Das sind 56.'), context(task))).toBe(true);
  });

  it('computes a subtraction', () => {
    expect(leaksSolution(hint('Am Ende bleiben 67 übrig.'), context('245 - 178 = ?'))).toBe(true);
  });

  it('finds the result written as a number word', () => {
    expect(leaksSolution(hint('Jedes Kind bekommt neun Murmeln.'), context('36 : 4 = ?'))).toBe(
      true,
    );
  });

  it('does not read the article "ein" as the number 1', () => {
    expect(leaksSolution(hint('Mach ein Bild von den Äpfeln.'), context('5 - 4 = ?'))).toBe(false);
  });

  it('never treats a number of the task as the solution', () => {
    expect(leaksSolution(hint('Wie viel sind 23 und 24 zusammen?'), CONTRACT_TASK)).toBe(false);
  });

  it("checks against the teacher's solution key", () => {
    const withKey = context('Wie viele Beine haben 3 Hühner und 2 Katzen?', { solutionKey: '14' });

    expect(leaksSolution(hint('Zusammen sind es 14 Beine.'), withKey)).toBe(true);
  });

  it('rejects the words of a key without numbers', () => {
    const withKey = context('Welches Tier bellt?', { solutionKey: 'der Hund' });

    expect(leaksSolution(hint('Es ist der Hund!'), withKey)).toBe(true);
    expect(leaksSolution(hint('Welche Tiere kennst du?'), withKey)).toBe(false);
  });

  it("lets praise after a correct answer repeat the child's own answer", () => {
    const answered = { ...CONTRACT_TASK, childAnswer: '47' };

    expect(leaksSolution(praise('Super, 47 stimmt!'), answered)).toBe(false);
    expect(leaksSolution(assessment('correct', 'Ja, 47 ist richtig.'), answered)).toBe(false);
  });

  it.each(['not_yet', 'partly_correct'] as const)(
    'never lets a %s assessment state the expected answer',
    (result) => {
      const answered = { ...CONTRACT_TASK, childAnswer: '41' };

      expect(leaksSolution(assessment(result, 'Fast! Richtig wäre 47.'), answered)).toBe(true);
    },
  );
});
