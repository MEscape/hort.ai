import { isValidScene } from '../evaluation/evaluate-answer';
import { FRACTION_LIMITS, GROUPS_LIMITS, NUMBER_LINE_LIMITS } from '../models/lesson-step';

import type { Fraction, Scene } from '../models/lesson-step';

/** The first sum, difference, product or quotient of two whole numbers in normalised math. */
const BINARY = /(\d+)\s*([-+*/])\s*(\d+)/;
const FRACTION = /(\d+)\s*\/\s*(\d+)/g;
const COMPARING = /größer|kleiner|mehr|weniger|vergleich|gleich groß|[<>]/;

/** Fraction pairs to fall back on when the task's pair has no same part to keep. */
const FRACTION_EXAMPLES: ReadonlyArray<readonly [Fraction, Fraction]> = [
  [
    { numerator: 1, denominator: 2 },
    { numerator: 1, denominator: 3 },
  ],
  [
    { numerator: 2, denominator: 3 },
    { numerator: 3, denominator: 4 },
  ],
  [
    { numerator: 3, denominator: 5 },
    { numerator: 1, denominator: 2 },
  ],
];

const sameFraction = (a: Fraction, b: Fraction) =>
  a.numerator === b.numerator && a.denominator === b.denominator;

/** A neighbour of `value` inside [min, max], never `value` itself. */
function neighbour(value: number, min: number, max: number): number {
  return value + 1 <= max ? value + 1 : Math.max(min, value - 1);
}

/** Same kind of comparison (same parts, or same number of parts) with other numbers. */
function similarFractions(a: Fraction, b: Fraction): readonly [Fraction, Fraction] | undefined {
  if (a.denominator === b.denominator) {
    const parts = a.denominator < FRACTION_LIMITS.maxParts ? a.denominator + 1 : a.denominator - 1;
    return [
      { numerator: Math.min(a.numerator, parts), denominator: parts },
      { numerator: Math.min(b.numerator, parts), denominator: parts },
    ];
  }
  if (a.numerator === b.numerator) {
    const laid = neighbour(a.numerator, 1, Math.min(a.denominator, b.denominator));
    return [
      { numerator: laid, denominator: a.denominator },
      { numerator: laid, denominator: b.denominator },
    ];
  }
  return FRACTION_EXAMPLES.find(
    ([x, y]) =>
      !(sameFraction(x, a) && sameFraction(y, b)) && !(sameFraction(x, b) && sameFraction(y, a)),
  );
}

function fractionScene(math: string): Scene | undefined {
  const [a, b] = [...math.matchAll(FRACTION)].map(([, numerator = '', denominator = '']) => ({
    numerator: Number(numerator),
    denominator: Number(denominator),
  }));
  if (a === undefined || b === undefined || !COMPARING.test(math)) {
    return undefined;
  }
  const pair = similarFractions(a, b);
  return pair === undefined
    ? undefined
    : { template: 'compare-bridges', sceneVersion: 1, top: pair[0], bottom: pair[1] };
}

/** Plus and minus: only the start moves, so the same jump lands somewhere else than the task's result. */
function numberLineScene(a: number, jump: number): Scene {
  const start = a + 1 + jump <= NUMBER_LINE_LIMITS.max ? a + 1 : a - 1;
  return { template: 'number-line', sceneVersion: 1, start, jump };
}

/** Times: the same number of plates with another number on each. */
function timesScene(groups: number, each: number): Scene {
  return {
    template: 'groups',
    sceneVersion: 1,
    groups,
    each: neighbour(each, 1, GROUPS_LIMITS.maxEach),
    ask: 'total',
  };
}

/** Divided by: the same number of plates, another share on each; only whole shares. */
function shareScene(total: number, groups: number): Scene | undefined {
  if (groups === 0 || total % groups !== 0) {
    return undefined;
  }
  return {
    template: 'groups',
    sceneVersion: 1,
    groups,
    each: neighbour(total / groups, 1, GROUPS_LIMITS.maxEach),
    ask: 'each',
  };
}

function arithmeticScene(math: string): Scene | undefined {
  const [, left = '', operator = '', right = ''] = BINARY.exec(math) ?? [];
  const a = Number(left);
  const b = Number(right);
  switch (operator) {
    case '+':
      return numberLineScene(a, b);
    case '-':
      return numberLineScene(a, -b);
    case '*':
      return timesScene(a, b);
    case '/':
      return shareScene(a, b);
    default:
      return undefined;
  }
}

/**
 * The scene for a child's own task, from its math alone: the same kind of problem with other
 * numbers, so the picture explains the idea without solving the child's task (the vision's "never
 * the solution"). Fractions to compare become bridges, plus and minus a number-line jump, times and
 * divided-by plates of dots. `undefined` when the task has no math a template can draw; the screen
 * then helps without a scene. Deterministic: the same task always gets the same scene, so nothing
 * needs storing and the backend can judge the answer by planning it again.
 */
export function planTaskScene(math: string): Scene | undefined {
  const scene = fractionScene(math) ?? arithmeticScene(math);
  return scene !== undefined && isValidScene(scene) ? scene : undefined;
}
