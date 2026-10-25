import type { AssessmentResult } from '../ai-output/ai-output';

/** German number words up to twenty, so "sieben" matches a key of 7. Larger numbers are written as digits. */
const NUMBER_WORDS: Readonly<Record<string, string>> = {
  null: '0',
  eins: '1',
  ein: '1',
  eine: '1',
  zwei: '2',
  drei: '3',
  vier: '4',
  fünf: '5',
  sechs: '6',
  sieben: '7',
  acht: '8',
  neun: '9',
  zehn: '10',
  elf: '11',
  zwölf: '12',
  dreizehn: '13',
  vierzehn: '14',
  fünfzehn: '15',
  sechzehn: '16',
  siebzehn: '17',
  achtzehn: '18',
  neunzehn: '19',
  zwanzig: '20',
};

const NUMBER = /\d+(?:\.\d+)?/g;

/** Lower case, decimal comma as point, number words as digits, only letters, digits, `.`, `=` and single spaces. */
function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[^\p{L}\p{N}.=]+/gu, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .split(' ')
    .filter((token) => token !== '')
    .map((token) => NUMBER_WORDS[token] ?? token)
    .join(' ');
}

/** The numbers of an answer; after an `=` only the ones that follow the last one ("3 + 4 = 7" answers 7). */
function answerNumbers(answer: string): string[] {
  const afterEquals = answer.slice(answer.lastIndexOf('=') + 1);
  return afterEquals.match(NUMBER) ?? [];
}

/**
 * Checks the child's answer against the teacher's solution key (#14, #33), deterministically and
 * without the AI. A key with numbers is met when the answer's numbers are exactly the key's, in
 * order, whatever words surround them ("Sie hat 7 Äpfel" meets "7"). A key without numbers is met
 * when every word of the key appears in the answer ("der Hund" meets "Hund"). Anything else is
 * `not_yet`: "partly correct" needs judgement, so only the AI assesses it, and only without a key.
 *
 * The key never leaves the backend: it is not passed to the AI and not shown to the child.
 */
export function checkAgainstSolutionKey(answer: string, solutionKey: string): AssessmentResult {
  const given = normalize(answer);
  const expected = normalize(solutionKey);
  if (given === expected) {
    return 'correct';
  }
  const keyNumbers = expected.match(NUMBER) ?? [];
  if (keyNumbers.length > 0) {
    const numbers = answerNumbers(given);
    const same =
      numbers.length === keyNumbers.length &&
      numbers.every((n, i) => Number(n) === Number(keyNumbers[i]));
    return same ? 'correct' : 'not_yet';
  }
  const words = new Set(given.split(' '));
  return expected.split(' ').every((word) => words.has(word)) ? 'correct' : 'not_yet';
}
