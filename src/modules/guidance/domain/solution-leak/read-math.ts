import { isDefined } from '@lib/utils';

/**
 * Reads the arithmetic in a German text the way a child's task and a hint write it: digits with a
 * decimal comma, spelled-out numbers ("siebenundvierzig"), `plus`/`minus`/`mal`/`geteilt durch` and
 * the school operators `·`, `×`, `:` and `÷`. Deterministic and without the AI (#31).
 */

const UNITS: Readonly<Record<string, number>> = {
  ein: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
};

/** Words that are a number on their own. "ein", "eine" are articles far more often than the number one, so only "eins" counts. */
const SINGLE_WORDS: Readonly<Record<string, number>> = {
  null: 0,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  dreizehn: 13,
  vierzehn: 14,
  fünfzehn: 15,
  sechzehn: 16,
  siebzehn: 17,
  achtzehn: 18,
  neunzehn: 19,
};

const TENS: Readonly<Record<string, number>> = {
  zwanzig: 20,
  dreißig: 30,
  dreissig: 30,
  vierzig: 40,
  fünfzig: 50,
  sechzig: 60,
  siebzig: 70,
  achtzig: 80,
  neunzig: 90,
};

const HUNDRED = { word: 'hundert', value: 100 } as const;
const THOUSAND = { word: 'tausend', value: 1000 } as const;

/** Six decimal places are far beyond school arithmetic and absorb floating-point noise. */
const PRECISION = 1e6;

const NUMBER = String.raw`\d+(?:\.\d+)?`;
const OPERATOR = String.raw`\s*[-+*/]\s*`;
const EXPRESSION = String.raw`${NUMBER}(?:${OPERATOR}${NUMBER})+`;
const NUMBER_PATTERN = new RegExp(NUMBER, 'g');
const EXPRESSION_PATTERN = new RegExp(EXPRESSION, 'g');
const EQUATION_PATTERN = new RegExp(String.raw`(${EXPRESSION})\s*=\s*(${NUMBER})`, 'g');

function belowHundred(word: string): number | null {
  const single = SINGLE_WORDS[word] ?? TENS[word];
  if (single !== undefined) {
    return single;
  }
  const compound = /^(.+?)und(.+)$/.exec(word);
  const unit = compound?.[1] === undefined ? undefined : UNITS[compound[1]];
  const tens = compound?.[2] === undefined ? undefined : TENS[compound[2]];
  return unit === undefined || tens === undefined ? null : unit + tens;
}

/** "zweihundertdrei" is 2 · 100 + 3; `head` reads what stands before the multiplier word. */
function withMultiplier(
  word: string,
  multiplier: { readonly word: string; readonly value: number },
  read: {
    readonly head: (part: string) => number | null;
    readonly tail: (part: string) => number | null;
  },
): number | null {
  const at = word.indexOf(multiplier.word);
  if (at < 0) {
    return read.tail(word);
  }
  const head = word.slice(0, at);
  const tail = word.slice(at + multiplier.word.length).replace(/^und/, '');
  const times = head === '' ? 1 : read.head(head);
  const rest = tail === '' ? 0 : read.tail(tail);
  return times === null || rest === null ? null : times * multiplier.value + rest;
}

function belowThousand(word: string): number | null {
  return withMultiplier(word, HUNDRED, { head: (part) => UNITS[part] ?? null, tail: belowHundred });
}

/** A German number word up to 999 999, or null when the word is not one. */
export function numberWord(word: string): number | null {
  return withMultiplier(word, THOUSAND, {
    head: (part) => UNITS[part] ?? belowThousand(part),
    tail: belowThousand,
  });
}

/** "2 € 50 ct" and "2 Euro und 50 Cent": one amount, written like "2,50 €". */
const EURO_AND_CENT = /(\d+)\s*(?:€|euro)\s*(?:und\s+)?(\d{1,2})\s*(?:ct|cent)\b/g;

/**
 * A clock time such as "15:45 Uhr" or "um 16:35": it counts as minutes since midnight, so "16:35"
 * is found as 15:45 plus 50 minutes. Without "Uhr" or a time preposition, "20:10" stays a division.
 */
const CLOCK_TIME =
  /(?<=\b(?:um|ab|bis|von|gegen)\s+)([01]?\d|2[0-3]):([0-5]\d)(?![\d:])|(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?=\s*uhr\b)/g;
const MINUTES_PER_HOUR = 60;

function minutesSinceMidnight(hours = '0', minutes = '0'): string {
  return String(Number(hours) * MINUTES_PER_HOUR + Number(minutes));
}

function withNumberWords(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\p{L}+/gu, (word) => {
      const value = numberWord(word);
      return value === null ? word : String(value);
    });
}

/** German thousands dots ("1.000", "12.345.678"); dropped before the decimal comma is read, so "1,500" stays one and a half. */
const THOUSANDS = /(?<![\d.,])[1-9]\d{0,2}(?:\.\d{3})+(?!\d|\.\d)/g;

function withOneNotation(math: string): string {
  return math
    .replace(THOUSANDS, (grouped) => grouped.replaceAll('.', ''))
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\bgeteilt durch\b|\bdurch\b|÷/g, ' / ')
    .replace(/\bplus\b/g, ' + ')
    .replace(/\bminus\b|[−–]/g, ' - ')
    .replace(/\bmal\b|[·×]/g, ' * ')
    .replace(/(\d)\s*:\s*(?=\d)/g, '$1 / ')
    .replace(/(\d)\s*x\s*(?=\d)/g, '$1 * ');
}

/**
 * Lower case, number words as digits, money and clock times as one number each, decimal comma as
 * point and every operator as `+ - * /`, so the patterns below see one notation.
 */
export function readMath(text: string): string {
  return withOneNotation(
    withNumberWords(text)
      .replace(
        EURO_AND_CENT,
        (_match, euros: string, cents: string) => `${euros},${cents.padStart(2, '0')} €`,
      )
      .replace(
        CLOCK_TIME,
        (_match, ...[byWord, byWordMinutes, byUhr, byUhrMinutes]: Array<string | undefined>) =>
          byWord === undefined
            ? minutesSinceMidnight(byUhr, byUhrMinutes)
            : minutesSinceMidnight(byWord, byWordMinutes),
      ),
  );
}

/**
 * Like `readMath`, but euros and cents and the parts of a clock time stay separate numbers
 * ("2 € 50 ct" is 2 and 50): a hint that works on those parts ("50 · 3 = 150 Cent") still works
 * the child's task.
 */
export function readMathAsWritten(text: string): string {
  return withOneNotation(withNumberWords(text));
}

/** A number rounded so that equal values compare equal in a `Set`. */
export function numberKey(value: number): number {
  return Math.round(value * PRECISION) / PRECISION;
}

/** Every number in a text already passed through `readMath`. */
export function numbersIn(math: string): number[] {
  return (math.match(NUMBER_PATTERN) ?? []).map((n) => numberKey(Number(n)));
}

/** NaN for a division by zero, so the whole expression counts as not computable. */
function divide(dividend: number, divisor: number): number {
  return divisor === 0 ? Number.NaN : dividend / divisor;
}

/** Point before line: `*` and `/` bind first. Null for a division by zero. */
export function evaluate(expression: string): number | null {
  const operands = numbersIn(expression);
  const operators = expression.match(/(?<=\d\s*)[-+*/]/g) ?? [];
  const sums: number[] = [operands[0] ?? 0];
  const signs: string[] = [];
  operators.forEach((operator, i) => {
    const operand = operands[i + 1] ?? 0;
    if (operator === '*' || operator === '/') {
      const last = sums.pop() ?? 0;
      sums.push(operator === '*' ? last * operand : divide(last, operand));
    } else {
      sums.push(operand);
      signs.push(operator);
    }
  });
  const total = sums
    .slice(1)
    .reduce((acc, value, i) => (signs[i] === '-' ? acc - value : acc + value), sums[0] ?? 0);
  return Number.isFinite(total) ? numberKey(total) : null;
}

/** The computable expressions of a text ("23 + 24"), with their values. */
export function expressionsIn(math: string): number[] {
  return (math.match(EXPRESSION_PATTERN) ?? []).map(evaluate).filter(isDefined);
}

/** An equation the text states correctly, such as "20 + 20 = 40". */
export interface SolvedEquation {
  readonly operands: readonly number[];
  readonly result: number;
}

/** The equations of a text whose stated result is right; a wrong one computes nothing. */
export function solvedEquationsIn(math: string): SolvedEquation[] {
  return [...math.matchAll(EQUATION_PATTERN)].flatMap(([, left = '', stated = '']) => {
    const result = numberKey(Number(stated));
    return evaluate(left) === result ? [{ operands: numbersIn(left), result }] : [];
  });
}
