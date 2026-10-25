import { NUMBER_WORDS } from '../answer-check/check-against-solution-key';

import type { AiOutput } from './ai-output';

/**
 * The solution-leak guard (#31, docs/architecture/ai-output-contract.md "Leaking the solution").
 * Hort.ai must never solve the child's task, and a prompt alone cannot promise that, so every
 * validated AI text is checked here, deterministically and without another AI call.
 *
 * The guard does not understand the text; it looks for the numbers a solution would contain:
 * - the teacher's solution key, when the task is an assignment (#33);
 * - the result of every explicit calculation in the task ("23 + 24 = ?", "36 : 4", "7 x 8");
 * - for an arithmetic sequence ("4, 8, 12, 16, __"), its next terms;
 * - for a word problem without an operator ("36 Murmeln ... an 4 Kinder"), every result of the
 *   four basic operations on two of its numbers. Primary-school word problems are mostly one step,
 *   so this covers the answer; the other results are false alarms, which only cost a predefined
 *   prompt, while a missed leak would cost the whole point of Hort.ai.
 * Numbers that already stand in the task are never candidates: a hint has to talk about them.
 * Money ("2 € 50 ct", "7,50 €") and clock times ("15:45") count as one quantity each, so
 * "16:35 Uhr" is found as 15:45 plus 50 minutes. A text with any candidate is a leak, which also
 * catches a fully worked solution and a complete answer sentence, since both end in the result.
 *
 * Known limits: number words above twenty, multi-step word problems and answers that are not
 * numbers without a key are not detected; the prompt (#10) still forbids them.
 */

/** Everything the guard knows about the task; never passed to the AI and never logged. */
export interface SolutionContext {
  readonly task: string;
  /** The teacher's key (#33), or null for a child's own task. */
  readonly solutionKey: string | null;
  /** The child's own answer when the text is feedback on it (#14), otherwise null. */
  readonly childAnswer: string | null;
}

type Operator = '+' | '-' | '*' | '/';
type Token =
  { readonly number: number } | { readonly operator: Operator } | { readonly other: true };

const MINUTES_PER_HOUR = 60;
const CENTS_PER_EURO = 100;
const SEQUENCE_MIN_TERMS = 3;
const SEQUENCE_NEXT_TERMS = 3;
/** Results are compared in hundredths, enough for euros and cents. */
const PRECISION = 100;

const OPERATORS: Readonly<Record<string, Operator>> = {
  '+': '+',
  '-': '-',
  '−': '-',
  '–': '-',
  '*': '*',
  '·': '*',
  '⋅': '*',
  '×': '*',
  x: '*',
  ':': '/',
  '÷': '/',
  '/': '/',
};

/** "ein" and "eine" are articles far more often than numbers; reading them as 1 would flag almost every text. */
const ARTICLES = new Set(['ein', 'eine']);

/**
 * One token per quantity, operator or other word, in reading order. Clock times need two-digit
 * minutes without spaces, so "36 : 4" stays a division; a dot followed by three digits is the
 * German thousands separator, a comma the decimal mark.
 */
const TOKEN =
  /(\d{1,2}):(\d{2})(?!\d)|(\d{1,2})\.(\d{2})(?=\s*uhr)|(\d+)\s*(?:€|euro)\s*(?:und\s+)?(\d{1,2})\s*(?:ct|cent)\b|(\d{1,3}(?:\.\d{3})+)(?!\d)|(\d+),(\d+)|(\d+)|(?<=\d\s*)([+\-−–*·⋅×x:÷/])(?=\s*\d)|(\p{L}+)/gu;

function numberToken(match: RegExpExecArray): number | null {
  const [, hours, minutes, dotHours, dotMinutes, euros, cents, thousands, whole, fraction, plain] =
    match;
  if (hours !== undefined && minutes !== undefined) {
    return Number(hours) * MINUTES_PER_HOUR + Number(minutes);
  }
  if (dotHours !== undefined && dotMinutes !== undefined) {
    return Number(dotHours) * MINUTES_PER_HOUR + Number(dotMinutes);
  }
  if (euros !== undefined && cents !== undefined) {
    return Number(euros) + Number(cents) / CENTS_PER_EURO;
  }
  if (thousands !== undefined) {
    return Number(thousands.replaceAll('.', ''));
  }
  if (whole !== undefined && fraction !== undefined) {
    return Number(`${whole}.${fraction}`);
  }
  return plain === undefined ? null : Number(plain);
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.normalize('NFKC').toLowerCase().matchAll(TOKEN)) {
    const number = numberToken(match);
    const operator = match[11];
    const word = match[12];
    if (number !== null) {
      tokens.push({ number });
    } else if (operator !== undefined) {
      tokens.push({ operator: OPERATORS[operator] ?? '+' });
    } else if (word !== undefined && !ARTICLES.has(word) && NUMBER_WORDS[word] !== undefined) {
      tokens.push({ number: Number(NUMBER_WORDS[word]) });
    } else {
      tokens.push({ other: true });
    }
  }
  return tokens;
}

const quantities = (tokens: readonly Token[]): number[] =>
  tokens.flatMap((token) => ('number' in token ? [token.number] : []));

const key = (value: number): number => Math.round(value * PRECISION);

function apply(left: number, operator: Operator, right: number): number {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      return left / right;
  }
}

/** A chain such as `3 + 4 · 2`, evaluated with point before line. */
function evaluate(numbers: readonly number[], operators: readonly Operator[]): number {
  const terms = [numbers[0] ?? 0];
  const lineOperators: Operator[] = [];
  operators.forEach((operator, i) => {
    const right = numbers[i + 1] ?? 0;
    if (operator === '*' || operator === '/') {
      terms.push(apply(terms.pop() ?? 0, operator, right));
    } else {
      terms.push(right);
      lineOperators.push(operator);
    }
  });
  return lineOperators.reduce(
    (sum, operator, i) => apply(sum, operator, terms[i + 1] ?? 0),
    terms[0] ?? 0,
  );
}

/**
 * The results of the explicit calculations in the task: every `number (operator number)+` chain,
 * and each single step of it, so a stray operator ("Aufgabe 3: 12 + 5") cannot hide the result.
 */
function explicitResults(tokens: readonly Token[]): number[] {
  const results: number[] = [];
  let numbers: number[] = [];
  let operators: Operator[] = [];
  const close = () => {
    if (operators.length > 0 && numbers.length === operators.length + 1) {
      results.push(evaluate(numbers, operators));
      operators.forEach((operator, i) =>
        results.push(apply(numbers[i] ?? 0, operator, numbers[i + 1] ?? 0)),
      );
    }
    numbers = [];
    operators = [];
  };
  for (const token of tokens) {
    if ('number' in token) {
      if (numbers.length > operators.length) {
        close();
      }
      numbers.push(token.number);
    } else if ('operator' in token && numbers.length === operators.length + 1) {
      operators.push(token.operator);
    } else {
      close();
    }
  }
  close();
  return results;
}

/** The next terms when the task's numbers form an arithmetic sequence of at least three terms. */
function sequenceContinuation(numbers: readonly number[]): number[] {
  if (numbers.length < SEQUENCE_MIN_TERMS) {
    return [];
  }
  const step = (numbers[1] ?? 0) - (numbers[0] ?? 0);
  const isSequence =
    step !== 0 && numbers.every((n, i) => i === 0 || n - (numbers[i - 1] ?? 0) === step);
  if (!isSequence) {
    return [];
  }
  const last = numbers.at(-1) ?? 0;
  return Array.from({ length: SEQUENCE_NEXT_TERMS }, (_, i) => last + step * (i + 1));
}

/** One-step results on two numbers of a word problem; divisions only when they come out even. */
function oneStepResults(numbers: readonly number[]): number[] {
  return numbers.flatMap((a, i) =>
    numbers.flatMap((b, j) => {
      if (i === j) {
        return [];
      }
      const results = [a + b, a - b, a * b];
      return b !== 0 && Number.isInteger(a / b) ? [...results, a / b] : results;
    }),
  );
}

function candidatesFromTask(tokens: readonly Token[]): number[] {
  const explicit = explicitResults(tokens);
  if (explicit.length > 0) {
    return explicit;
  }
  const numbers = quantities(tokens);
  const sequence = sequenceContinuation(numbers);
  return sequence.length > 0 ? sequence : oneStepResults(numbers);
}

/** Feedback after a correct answer may repeat the child's own answer; anything else may not. */
function mayRepeatChildAnswer(output: AiOutput): boolean {
  return output.kind === 'answer_assessment'
    ? output.result === 'correct'
    : output.kind === 'praise' || output.kind === 'comprehension_question';
}

/** A key without numbers ("der Hund") leaks when its words appear in the text in the same order. */
function containsWordKey(text: string, solutionKey: string): boolean {
  const words = (value: string) =>
    ` ${value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}]+/gu, ' ')
      .trim()} `;
  const keyWords = words(solutionKey);
  return keyWords.trim() !== '' && words(text).includes(keyWords);
}

/** Whether the validated AI text gives away the solution of the child's task. */
export function leaksSolution(output: AiOutput, context: SolutionContext): boolean {
  const taskTokens = tokenize(context.task);
  const keyNumbers = context.solutionKey === null ? [] : quantities(tokenize(context.solutionKey));
  if (
    context.solutionKey !== null &&
    keyNumbers.length === 0 &&
    containsWordKey(output.text, context.solutionKey)
  ) {
    return true;
  }
  const allowed = new Set(quantities(taskTokens).map(key));
  if (context.childAnswer !== null && mayRepeatChildAnswer(output)) {
    quantities(tokenize(context.childAnswer)).forEach((n) => allowed.add(key(n)));
  }
  const candidates = new Set(
    [...keyNumbers, ...candidatesFromTask(taskTokens)]
      .filter((n) => Number.isFinite(n) && n > 0)
      .map(key)
      .filter((n) => !allowed.has(n)),
  );
  return quantities(tokenize(output.text)).some((n) => candidates.has(key(n)));
}
