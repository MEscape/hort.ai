import { unique } from '@lib/utils';

import { expressionsIn, numberKey, numbersIn, readMath } from './read-math';

/** Word problems name their numbers in prose; with more than this many, guessing the operation stops being useful. */
const MAX_WORD_PROBLEM_NUMBERS = 4;

/** Results of guessed operations that are too common in any hint ("Schritt 1") to count as a leak. */
const TRIVIAL_GUESSES: ReadonlySet<number> = new Set([0, 1]);

/** Short words of a text answer that say nothing on their own. */
const FILLER_WORDS: ReadonlySet<string> = new Set([
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einen',
  'einem',
  'einer',
  'und',
  'oder',
  'ist',
  'sind',
  'hat',
  'haben',
  'mit',
  'von',
  'für',
  'auf',
  'aus',
  'bei',
  'sie',
  'ihr',
]);

const DECIMAL_BASE = 10;

/** Words shorter than this ("ja", "b") are too common to match against a hint. */
const MIN_KEY_WORD_LENGTH = 3;

/** What the backend knows about the solution of one task; never sent to the AI or the child. */
export interface KnownSolutions {
  /** Results the text must not state: computed from the task, or the numbers of the teacher's key. */
  readonly results: ReadonlySet<number>;
  /** The words of a text answer from the teacher's key; a text containing all of them gives it away. */
  readonly keyWords: readonly string[];
  /** The task's numbers and their place-value parts (23 → 20, 3): a step on these works the child's task. */
  readonly taskParts: ReadonlySet<number>;
}

function placeValueParts(value: number): number[] {
  if (!Number.isInteger(value)) {
    return [value];
  }
  const digits = String(Math.abs(value)).split('');
  return [
    value,
    ...digits
      .map((digit, i) => Number(digit) * DECIMAL_BASE ** (digits.length - 1 - i))
      .filter((part) => part !== 0),
  ];
}

/**
 * A word problem ("Tom hat 23 Murmeln und bekommt 24 dazu") does not say which operation it wants,
 * so every basic operation on each pair of its numbers is treated as a possible result. Stricter
 * than needed, never weaker: a hint does not need to name a number the child has to compute.
 */
function guessedResults(numbers: readonly number[]): number[] {
  if (numbers.length < 2 || numbers.length > MAX_WORD_PROBLEM_NUMBERS) {
    return [];
  }
  const results = numbers.flatMap((a, i) =>
    numbers.slice(i + 1).flatMap((b) => {
      const quotients = [a / b, b / a].filter((q) => Number.isInteger(q));
      return [a + b, Math.abs(a - b), a * b, ...quotients];
    }),
  );
  const total = numbers.reduce((sum, n) => sum + n, 0);
  return [...results, total].map(numberKey).filter((n) => !TRIVIAL_GUESSES.has(n));
}

function keyWordsOf(solutionKey: string): string[] {
  const words =
    solutionKey
      .normalize('NFKC')
      .toLowerCase()
      .match(/\p{L}+/gu) ?? [];
  return unique(
    words.filter((word) => word.length >= MIN_KEY_WORD_LENGTH && !FILLER_WORDS.has(word)),
  );
}

/**
 * The solutions a text must not reveal. A written expression ("23 + 24", "3 · 4 + 5") is computed;
 * a word problem gets every result its numbers allow; the teacher's key (#33) adds its own numbers,
 * or its words for a text answer. A number the task itself shows is not a result: repeating the
 * task reveals nothing the child cannot already see.
 */
export function knownSolutions(task: string, solutionKey: string | null): KnownSolutions {
  const taskMath = readMath(task);
  const taskNumbers = unique(numbersIn(taskMath));
  const written = expressionsIn(taskMath);
  const derived = written.length > 0 ? written : guessedResults(taskNumbers);
  const keyNumbers = solutionKey === null ? [] : numbersIn(readMath(solutionKey));
  const shown = new Set(taskNumbers);
  return {
    results: new Set([...derived, ...keyNumbers].filter((n) => !shown.has(n))),
    keyWords: solutionKey !== null && keyNumbers.length === 0 ? keyWordsOf(solutionKey) : [],
    taskParts: new Set(taskNumbers.flatMap(placeValueParts)),
  };
}
