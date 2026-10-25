import { SOLUTION_LEAK_VALIDATION_CODES } from '../errors/solution-leak-errors';

import { knownSolutions } from './known-solutions';
import { numbersIn, readMath, solvedEquationsIn } from './read-math';

import type { KnownSolutions } from './known-solutions';
import type { AiOutput, AiOutputKind } from '../ai-output/ai-output';
import type { SolutionLeakValidationCode } from '../errors/solution-leak-errors';
import type { HintLevel } from '../models/hint-level';

/** What the backend knows about the task the AI text is about. Never sent to the AI. */
export interface SolutionContext {
  /** The child's task text. */
  readonly task: string;
  /** The teacher's solution key of an assignment (#33), when there is one. */
  readonly solutionKey: string | null;
  /** The child's own answer, when the text is feedback on it (#14). */
  readonly answer: string | null;
}

/**
 * How many steps of the child's own task a text may compute at each level of the hint ladder (#30).
 * Only "next step" may show one; a similar example must use a different problem.
 */
const SOLVED_STEPS_ALLOWED: Readonly<Record<HintLevel, number>> = {
  understand_task: 0,
  activate_prior_knowledge: 0,
  next_step: 1,
  similar_example: 0,
};

/** Kinds worded only after a correct answer (#14): repeating the child's own result reveals nothing. */
const AFTER_CORRECT_ANSWER: ReadonlySet<AiOutputKind> = new Set([
  'praise',
  'comprehension_question',
]);

/** A number presented as the result, whatever the task: "Die Lösung lautet 12", "Richtig wäre 47". */
const ANNOUNCED_RESULT =
  /\b(?:ergebnis|lösung|antwort|summe|differenz|produkt|quotient|richtig)(?:\s+(?:ist|lautet|wäre|heißt|sind)\s*:?|\s*:)\s*(?:also\s+|genau\s+|dann\s+)?(\d+(?:\.\d+)?)/gu;

/** The child is told what to write: "Schreib: …", "Schreib einfach: …". */
const DICTATED_ANSWER = /\b(?:schreib|schreibe|notier|notiere|trag|trage)\b[^.!?]*?:/u;

function words(text: string): Set<string> {
  return new Set(
    text
      .normalize('NFKC')
      .toLowerCase()
      .match(/\p{L}+/gu) ?? [],
  );
}

/** Correct equations on the task's numbers, or on results the text already computed from them. */
function solvedSteps(math: string, taskParts: ReadonlySet<number>): number {
  const known = new Set(taskParts);
  let steps = 0;
  for (const { operands, result } of solvedEquationsIn(math)) {
    if (operands.every((operand) => known.has(operand))) {
      steps += 1;
      known.add(result);
    }
  }
  return steps;
}

function resultLeaks(math: string, solutions: KnownSolutions, own: ReadonlySet<number>) {
  const announced = [...math.matchAll(ANNOUNCED_RESULT)].map(([, n = '']) => Number(n));
  return {
    states: numbersIn(math).some((n) => solutions.results.has(n) && !own.has(n)),
    announces: announced.some((n) => !own.has(n)),
  };
}

/**
 * The solution-leak guard (#31): checks a validated AI text against the task, the teacher's key
 * and the hint level, deterministically and without the AI. It rejects the result of the task (as
 * digits or spelled out, even inside a "similar" example that gives the same number), any number
 * presented as the result, a dictated answer, the words of a text key, and more solved steps of the
 * child's own task than the level allows. An empty list means the text may be shown.
 *
 * A second check (a classifier, the AI) may only reject more, never let through what this rejects.
 */
export function findSolutionLeaks(
  output: AiOutput,
  context: SolutionContext,
): SolutionLeakValidationCode[] {
  const math = readMath(output.text);
  const solutions = knownSolutions(context.task, context.solutionKey);
  const own = new Set(
    AFTER_CORRECT_ANSWER.has(output.kind) && context.answer !== null
      ? numbersIn(readMath(context.answer))
      : [],
  );
  const { states, announces } = resultLeaks(math, solutions, own);
  const textWords = words(output.text);
  const checks: ReadonlyArray<[boolean, SolutionLeakValidationCode]> = [
    [states, SOLUTION_LEAK_VALIDATION_CODES.statesResult],
    [announces, SOLUTION_LEAK_VALIDATION_CODES.announcesResult],
    [DICTATED_ANSWER.test(math), SOLUTION_LEAK_VALIDATION_CODES.dictatesAnswer],
    [
      solvedSteps(math, solutions.taskParts) > SOLVED_STEPS_ALLOWED[output.hintLevel],
      SOLUTION_LEAK_VALIDATION_CODES.worksTheTask,
    ],
    [
      solutions.keyWords.length > 0 && solutions.keyWords.every((word) => textWords.has(word)),
      SOLUTION_LEAK_VALIDATION_CODES.revealsKeyText,
    ],
  ];
  return checks.filter(([leaks]) => leaks).map(([, code]) => code);
}
