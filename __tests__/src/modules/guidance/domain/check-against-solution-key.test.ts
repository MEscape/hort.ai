import { describe, expect, it } from 'vitest';

import { checkAgainstSolutionKey } from '@modules/guidance/domain/answer-check/check-against-solution-key';

describe('checkAgainstSolutionKey', () => {
  it.each([
    ['7', '7'],
    ['Sie hat 7 Äpfel.', '7'],
    ['sieben', '7'],
    ['3 + 4 = 7', '7'],
    ['7 Äpfel', '7 Äpfel'],
    ['  SIEBEN  ', '7'],
    ['2,5', '2,5'],
    ['2,50 €', '2.5'],
    ['12 und 15', '12, 15'],
    ['der Hund', 'Hund'],
    ['Der HUND!', 'hund'],
    ['siebenundvierzig', '47'],
    ['Es sind dreiundzwanzig Kinder.', '23'],
    ['Hund', 'Ein Hund'],
    ['der Hund', 'Ein Hund'],
    ['Ein Apfel', 'ein Apfel'],
  ])('accepts %j for the key %j', (answer, key) => {
    expect(checkAgainstSolutionKey(answer, key)).toBe('correct');
  });

  it.each([
    ['8', '7'],
    ['3 + 4', '7'],
    ['7 = 3 + 4', '7'],
    ['70', '7'],
    ['7 und 8', '7'],
    ['15 und 12', '12, 15'],
    ['die Katze', 'Hund'],
    ['', '7'],
    ['Ein Apfel', '7'],
    ['siebenundvierzig', '74'],
  ])('answers not yet for %j against the key %j', (answer, key) => {
    expect(checkAgainstSolutionKey(answer, key)).toBe('not_yet');
  });

  describe('on a task that offers options (#33, M2: listing every option is not the answer)', () => {
    const TASK = 'Welches Tier bellt? Hund, Katze oder Maus?';

    it.each([['Hund Katze Maus'], ['Der Hund oder die Katze'], ['Katze, Hund']])(
      'answers not yet for %j, which also names other options',
      (answer) => {
        expect(checkAgainstSolutionKey(answer, 'Hund', TASK)).toBe('not_yet');
      },
    );

    it.each([['Hund'], ['Der Hund bellt.'], ['Ein Hund']])('accepts %j', (answer) => {
      expect(checkAgainstSolutionKey(answer, 'Ein Hund', TASK)).toBe('correct');
    });
  });

  it('never answers partly correct: that needs judgement and is the AI’s, without a key', () => {
    expect(checkAgainstSolutionKey('7 Birnen', '7 Äpfel')).toBe('correct');
    expect(checkAgainstSolutionKey('Hund und Katze', 'Hund, Maus')).toBe('not_yet');
  });
});
