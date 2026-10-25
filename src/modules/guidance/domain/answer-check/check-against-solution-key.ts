import { numberWord } from '../solution-leak/read-math';

import type { AssessmentResult } from '../ai-output/ai-output';

const NUMBER = /\d+(?:\.\d+)?/g;

/** Articles say nothing about which answer was meant: the key "Ein Hund" is met by "der Hund". */
const ARTICLES = 'der|die|das|den|dem|des|ein|eine|einen|einem|einer|the|a|an';
const ARTICLE = new RegExp(`^(?:${ARTICLES})$`);

/**
 * The words a task offers to choose from: each one after a comma, "oder" or a sentence mark
 * ("Hund, Katze oder Maus"), past an article.
 * shortcut: any word after a comma counts, so a text answer repeating prose that follows a comma
 * in the task is not_yet; parse real option lists if teachers' keys run into it.
 */
const OPTION = new RegExp(
  String.raw`(?:^|[,:?!]|\b(?:oder|or)\b)\s*(?:(?:${ARTICLES})\s+)?(\p{L}+)`,
  'gu',
);

/** German thousands dots ("1.000", "12.345.678"); read before the decimal comma, so "1,500" stays one and a half. */
const THOUSANDS = /(?<![\d.])[1-9]\d{0,2}(?:\.\d{3})+(?![\d]|\.\d)/g;

/** Lower case, thousands dots dropped, decimal comma as point, number words as digits, only letters, digits, `.`, `=` and single spaces. */
function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(THOUSANDS, (grouped) => grouped.replaceAll('.', ''))
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[^\p{L}\p{N}.=]+/gu, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .split(' ')
    .filter((token) => token !== '')
    .map((token) => numberWord(token)?.toString() ?? token)
    .join(' ');
}

/** The numbers of an answer; after an `=` only the ones that follow the last one ("3 + 4 = 7" answers 7). */
function answerNumbers(answer: string): string[] {
  const afterEquals = answer.slice(answer.lastIndexOf('=') + 1);
  return afterEquals.match(NUMBER) ?? [];
}

function optionsOf(task: string): string[] {
  return [...task.normalize('NFKC').toLowerCase().matchAll(OPTION)].map(([, word = '']) => word);
}

/**
 * Checks the child's answer against the teacher's solution key (#14, #33), deterministically and
 * without the AI. A key with numbers is met when the answer's numbers are exactly the key's, in
 * order, whatever words surround them ("Sie hat 7 Äpfel" meets "7"). A key without numbers is met
 * when every word of the key but its articles appears in the answer ("der Hund" meets "Ein Hund"),
 * and the answer names none of the task's other options ("Hund Katze Maus" lists them all).
 * Anything else is `not_yet`: "partly correct" needs judgement, so only the AI assesses it, and
 * only without a key.
 *
 * The key never leaves the backend: it is not passed to the AI and not shown to the child.
 */
export function checkAgainstSolutionKey(
  answer: string,
  solutionKey: string,
  task = '',
): AssessmentResult {
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
  const keyWords = expected.split(' ').filter((word) => !ARTICLE.test(word));
  const otherOptions = optionsOf(task).filter((word) => !keyWords.includes(word));
  return keyWords.every((word) => words.has(word)) && !otherOptions.some((word) => words.has(word))
    ? 'correct'
    : 'not_yet';
}
