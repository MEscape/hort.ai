import { isDefined, unique } from '@lib/utils';

import { COMPARE_CHOICES } from '../models/lesson-step';

import type { CompareChoice, Scene, SceneAnswer } from '../models/lesson-step';

/** The words a child of grades 1 to 4 uses for each choice, German and English. */
const CHOICE_WORDS: Readonly<Record<CompareChoice, readonly string[]>> = {
  top: ['oben', 'obere', 'oberen', 'erste', 'ersten', 'top', 'upper', 'first'],
  bottom: ['unten', 'untere', 'unteren', 'zweite', 'zweiten', 'bottom', 'lower', 'second'],
  same: ['gleich', 'gleichviel', 'beide', 'same', 'equal', 'both'],
};

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  null: 0,
  keins: 0,
  zero: 0,
  none: 0,
  ein: 1,
  eins: 1,
  one: 1,
  zwei: 2,
  two: 2,
  drei: 3,
  three: 3,
  vier: 4,
  four: 4,
  fünf: 5,
  fuenf: 5,
  five: 5,
  sechs: 6,
  six: 6,
  sieben: 7,
  seven: 7,
  acht: 8,
  eight: 8,
  neun: 9,
  nine: 9,
  zehn: 10,
  ten: 10,
  elf: 11,
  eleven: 11,
  zwölf: 12,
  twelve: 12,
  zwanzig: 20,
  twenty: 20,
};

/** A "not" anywhere makes the answer unclear: "nicht oben" is not "oben", and guessing is worse than asking. */
const NEGATIONS = new Set(['nicht', 'kein', 'keine', 'not', 'no']);

const tokensOf = (message: string): readonly string[] =>
  message
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);

function onlyOne<T>(values: readonly T[]): T | undefined {
  const distinct = unique(values);
  return distinct.length === 1 ? distinct[0] : undefined;
}

function readNumber(token: string): number | undefined {
  return /^\d+$/.test(token) ? Number(token) : NUMBER_WORDS[token];
}

/**
 * Reads a typed (or spoken) answer into the scene event it stands for, by fixed word lists only.
 * Exactly one meaning or nothing: "oben", "die untere", "3" and "drei Bretter" are read; "oben oder
 * unten", "nicht oben" and anything else stay `undefined`, and the child is asked to say it again.
 */
export function readTextAnswer(scene: Scene, message: string): SceneAnswer | undefined {
  const tokens = tokensOf(message);
  if (tokens.some((token) => NEGATIONS.has(token))) {
    return undefined;
  }
  if (scene.template === 'compare-bridges') {
    const choice = onlyOne(
      tokens.flatMap((token) =>
        COMPARE_CHOICES.filter((option) => CHOICE_WORDS[option].includes(token)),
      ),
    );
    return choice === undefined ? undefined : { kind: 'choose', choice };
  }
  const numbers = unique(tokens.map(readNumber).filter(isDefined));
  if (scene.template === 'build-bridge') {
    const parts = scene.target.denominator;
    // "3 von 4" names the planks laid and the planks there are: the count is the other number.
    const laid = onlyOne(
      numbers.length === 2 ? numbers.filter((value) => value !== parts) : numbers,
    );
    return laid === undefined ? undefined : { kind: 'fill', laid };
  }
  const value = onlyOne(numbers);
  return value === undefined ? undefined : { kind: 'number', value };
}
