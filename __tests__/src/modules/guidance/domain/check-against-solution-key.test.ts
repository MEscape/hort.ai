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
    ['1000', '1.000'],
    ['1.000', '1000'],
    ['12.345,5', '12345,5'],
    ['1,500', '1.5'],
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
    ['1', '1.000'],
    ['1,5', '1.500'],
  ])('answers not yet for %j against the key %j', (answer, key) => {
    expect(checkAgainstSolutionKey(answer, key)).toBe('not_yet');
  });

  it('never answers partly correct: that needs judgement and is the AI’s, without a key', () => {
    expect(checkAgainstSolutionKey('7 Birnen', '7 Äpfel')).toBe('correct');
    expect(checkAgainstSolutionKey('Hund und Katze', 'Hund, Maus')).toBe('not_yet');
  });
});
