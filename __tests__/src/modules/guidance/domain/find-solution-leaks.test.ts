import { describe, expect, it } from 'vitest';

import type { AiOutput } from '@modules/guidance/domain/ai-output/ai-output';
import { SOLUTION_LEAK_VALIDATION_CODES } from '@modules/guidance/domain/errors/solution-leak-errors';
import type { HintLevel } from '@modules/guidance/domain/models/hint-level';
import { findSolutionLeaks } from '@modules/guidance/domain/solution-leak/find-solution-leaks';
import type { SolutionContext } from '@modules/guidance/domain/solution-leak/find-solution-leaks';

const CODES = SOLUTION_LEAK_VALIDATION_CODES;

const ARITHMETIC: SolutionContext = {
  task: 'Rechne: 23 + 24 = ?',
  solutionKey: null,
  answer: null,
};
const WORD_PROBLEM: SolutionContext = {
  task: 'Tom hat 23 Murmeln. Er bekommt 24 dazu. Wie viele Murmeln hat Tom jetzt?',
  solutionKey: null,
  answer: null,
};

function hint(text: string, hintLevel: HintLevel = 'next_step'): AiOutput {
  return { version: 1, kind: 'hint', hintLevel, text };
}

function leaksOf(output: AiOutput, context: SolutionContext = ARITHMETIC) {
  return findSolutionLeaks(output, context);
}

describe('findSolutionLeaks on the examples of the AI output contract', () => {
  it.each([
    ['the final numeric result', 'Das Ergebnis ist 47.'],
    ['a fully worked solution', '20 + 20 = 40, 3 + 4 = 7, also 47.'],
    ['a complete answer sentence for a text task', 'Schreib: Tom hat 47 Murmeln.'],
  ])('rejects %s', (_case, text) => {
    expect(leaksOf(hint(text))).not.toEqual([]);
    expect(leaksOf(hint(text), WORD_PROBLEM)).not.toEqual([]);
  });

  it('rejects an assessment that reveals the expected answer', () => {
    const assessment: AiOutput = {
      version: 1,
      kind: 'answer_assessment',
      hintLevel: 'next_step',
      result: 'not_yet',
      text: 'Fast! Richtig wäre 47.',
    };

    expect(leaksOf(assessment, { ...ARITHMETIC, answer: '46' })).toContain(CODES.statesResult);
  });

  it.each([
    'Rechne zuerst die Zehner zusammen: Wie viel ist 20 + 20?',
    'Welche Zahl gehört in die Lücke: 3 + __ = 7?',
  ])('lets the valid hint %j through', (text) => {
    expect(leaksOf(hint(text))).toEqual([]);
  });

  it('lets a similar example on a different problem through', () => {
    expect(
      leaksOf(hint('Schau mal: 34 + 13. Erst die Zehner, dann die Einer.', 'similar_example')),
    ).toEqual([]);
  });
});

describe('findSolutionLeaks: the result of the child’s task', () => {
  it.each([
    ['as digits', 'Tom hat am Ende 47 Murmeln.'],
    ['spelled out', 'Tom hat am Ende siebenundvierzig Murmeln.'],
    ['spelled out in capitals', 'SIEBENUNDVIERZIG ist es!'],
    ['inside a similar example that happens to give the same result', 'Zum Beispiel 30 + 17 = 47.'],
  ])('rejects the result %s', (_case, text) => {
    expect(leaksOf(hint(text), WORD_PROBLEM)).toContain(CODES.statesResult);
  });

  it('computes the result of a written expression, with precedence and German operators', () => {
    const context = { task: 'Wie viel ist 3 · 4 + 5?', solutionKey: null, answer: null };

    expect(leaksOf(hint('Es sind 17.'), context)).toContain(CODES.statesResult);
    expect(leaksOf(hint('Es sind 27.'), context)).toEqual([]);
  });

  it.each([
    ['12 : 3', '4'],
    ['12 geteilt durch 3', 'vier'],
    ['9 minus 4', '5'],
    ['6 mal 7', '42'],
    ['2,5 + 1,5', '4'],
  ])('knows that %s gives %s', (expression, result) => {
    const context = { task: `Rechne ${expression}.`, solutionKey: null, answer: null };

    expect(leaksOf(hint(`Am Ende kommt ${result} heraus.`), context)).toContain(CODES.statesResult);
  });

  it('does not count a number the task itself shows', () => {
    expect(leaksOf(hint('Was bedeuten die 23 und die 24 in der Aufgabe?'), WORD_PROBLEM)).toEqual(
      [],
    );
  });

  it('does not read the article "ein" as the number one', () => {
    const context = { task: 'Rechne 5 - 4.', solutionKey: null, answer: null };

    expect(leaksOf(hint('Stell dir ein Bild mit Punkten vor.'), context)).toEqual([]);
  });
});

describe('findSolutionLeaks: the teacher’s solution key', () => {
  const withKey = (solutionKey: string): SolutionContext => ({
    task: 'Lies den Text. Welches Tier bellt am Gartenzaun?',
    solutionKey,
    answer: null,
  });

  it('rejects a number of the key that the task cannot reveal', () => {
    const context = { task: 'Aufgabe 3 auf Seite 12', solutionKey: '47', answer: null };

    expect(leaksOf(hint('Ich glaube, es sind 47.'), context)).toContain(CODES.statesResult);
  });

  it('rejects the words of a text answer', () => {
    expect(leaksOf(hint('Denk an den Hund.'), withKey('der Hund'))).toContain(CODES.revealsKeyText);
  });

  it('lets a hint through that names none of the key’s words', () => {
    expect(leaksOf(hint('Lies noch einmal, wer am Zaun steht.'), withKey('der Hund'))).toEqual([]);
  });
});

describe('findSolutionLeaks: announced and dictated answers', () => {
  it('rejects a text that announces a number as the result, even when the result is unknown', () => {
    const context = { task: 'Löse die Aufgabe im Heft.', solutionKey: null, answer: null };

    expect(leaksOf(hint('Die Lösung lautet 12.'), context)).toContain(CODES.announcesResult);
  });

  it('rejects a text that dictates what the child should write', () => {
    expect(leaksOf(hint('Schreib einfach: Tom hat viele Murmeln.'), WORD_PROBLEM)).toContain(
      CODES.dictatesAnswer,
    );
  });

  it('lets a text through that talks about the result without stating it', () => {
    expect(leaksOf(hint('Ist das Ergebnis größer oder kleiner als 40?'), WORD_PROBLEM)).toEqual([]);
  });
});

describe('findSolutionLeaks: solved steps of the child’s own task', () => {
  it('allows one solved step at the next-step level', () => {
    expect(leaksOf(hint('20 + 20 = 40. Was machst du jetzt mit den Einern?'))).toEqual([]);
  });

  it('rejects two solved steps at the next-step level', () => {
    expect(leaksOf(hint('20 + 20 = 40 und 3 + 4 = 7. Was fehlt noch?'))).toContain(
      CODES.worksTheTask,
    );
  });

  it.each(['understand_task', 'activate_prior_knowledge', 'similar_example'] as const)(
    'rejects a solved step of the child’s task at %s',
    (level) => {
      expect(leaksOf(hint('Schau: 20 + 20 = 40. Und weiter?', level))).toContain(
        CODES.worksTheTask,
      );
    },
  );

  it('ignores a step of a different problem', () => {
    expect(leaksOf(hint('Zum Beispiel 30 + 10 = 40.', 'similar_example'))).toEqual([]);
  });
});

describe('findSolutionLeaks on feedback after a correct answer', () => {
  const praise = (text: string): AiOutput => ({
    version: 1,
    kind: 'praise',
    hintLevel: 'next_step',
    text,
  });

  it('lets praise repeat the number the child found themselves', () => {
    expect(
      leaksOf(praise('Super, 47 stimmt genau!'), { ...WORD_PROBLEM, answer: 'Er hat 47.' }),
    ).toEqual([]);
  });

  it('rejects praise that states a result the child did not write', () => {
    expect(leaksOf(praise('Super, 47 stimmt genau!'), { ...WORD_PROBLEM, answer: '46' })).toContain(
      CODES.statesResult,
    );
  });
});

describe('findSolutionLeaks on money and clock times (S3, S4 of docs/product/mvp-scope.md)', () => {
  const MONEY: SolutionContext = {
    task: 'Ein Heft kostet 2 € 50 ct. Tim kauft 3 Hefte. Wie viel muss er bezahlen?',
    solutionKey: null,
    answer: null,
  };
  const TIME_SPAN: SolutionContext = {
    task: 'Der Film beginnt um 15:45 Uhr und dauert 50 Minuten. Wann ist er zu Ende?',
    solutionKey: null,
    answer: null,
  };

  it.each([
    'Tim muss 7,50 € bezahlen.',
    'Das sind zusammen 7 € 50 ct.',
    'Er zahlt 7 Euro und 50 Cent.',
  ])('rejects the amount in %j', (text) => {
    expect(leaksOf(hint(text), MONEY)).not.toEqual([]);
  });

  it.each(['Der Film ist um 16:35 Uhr zu Ende.', 'Er endet um 16:35.'])(
    'rejects the end time in %j',
    (text) => {
      expect(leaksOf(hint(text), TIME_SPAN)).not.toEqual([]);
    },
  );

  it.each([
    [MONEY, 'Beispiel: 2 Stifte zu je 1 € 20 ct → 2 € und 40 ct = 2,40 €.'],
    [MONEY, 'Rechne erst die Euro, dann die Cent für alle Hefte.'],
    [TIME_SPAN, 'Wie viele Minuten sind es von 15:45 bis zur vollen Stunde?'],
    [
      TIME_SPAN,
      'Beispiel: Start 10:50, Dauer 30 Minuten: 10 Minuten bis 11:00, dann noch 20 → 11:20.',
    ],
  ])('lets the ladder hint %#  through', (context, text) => {
    expect(leaksOf(hint(text, 'similar_example'), context)).toEqual([]);
  });

  it('keeps "20:10" without a time word a division', () => {
    const division: SolutionContext = { task: 'Rechne: 20:10', solutionKey: null, answer: null };

    expect(leaksOf(hint('Es kommt 2 heraus.'), division)).not.toEqual([]);
  });
});
