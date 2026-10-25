import type { ResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import { leaksSolution } from '../../domain/ai-output/solution-leak';
import { validateAiOutput } from '../../domain/ai-output/validate-ai-output';
import {
  checkChildSafeText,
  flaggedBySafetyScores,
} from '../../domain/child-safety/check-child-safe-text';
import { AI_OUTPUT_VALIDATION_CODES } from '../../domain/errors/ai-output-errors';
import { SAFETY_CLASSIFIER_UNAVAILABLE } from '../../domain/errors/child-safety-errors';

import type { AiOutput, AiOutputRequest } from '../../domain/ai-output/ai-output';
import type { SolutionContext } from '../../domain/ai-output/solution-leak';
import type { HintFallbackReason } from '../../domain/models/hint-fallback-reason';
import type { HintProviderFailure } from '../../domain/ports/hint-provider.port';
import type { SafetyClassifier } from '../../domain/ports/safety-classifier.port';

const FALLBACK_BY_FAILURE = {
  timeout: 'timeout',
  unavailable: 'provider_unavailable',
} as const satisfies Record<HintProviderFailure['kind'], HintFallbackReason>;

/** Either the validated output to use, or why the predefined text is used instead and which rules said so. */
export type Verdict =
  | { readonly output: AiOutput }
  | { readonly reason: HintFallbackReason; readonly codes: readonly string[] };

/**
 * The second safety check (#11): a classifier rates the text that passed the word lists. When it
 * cannot answer, the text is not shown; the predefined prompt is always safe.
 */
async function classifierVerdict(output: AiOutput, safety: SafetyClassifier): Promise<Verdict> {
  return safety.classify(output.text).match(
    (scores): Verdict => {
      const codes = flaggedBySafetyScores(scores);
      return codes.length === 0 ? { output } : { reason: 'unsafe_output', codes };
    },
    (): Verdict => ({ reason: 'provider_unavailable', codes: [SAFETY_CLASSIFIER_UNAVAILABLE] }),
  );
}

/** What the answer is checked against besides the contract. */
export interface AnswerGuards {
  /** The task, the teacher's key and the child's answer, for the solution-leak guard (#31). */
  readonly solution: SolutionContext;
  /** The second safety check (#11); without one only the word lists apply. */
  readonly safety?: SafetyClassifier | undefined;
}

/** The checks on a contract-conforming text that need no provider: the leak guard, then the word lists. */
function textVerdict(output: AiOutput, solution: SolutionContext): Verdict {
  if (leaksSolution(output, solution)) {
    // Only the code is logged: the task, the key and the text stay out of the audit log.
    return { reason: 'invalid_output', codes: [AI_OUTPUT_VALIDATION_CODES.solutionLeaked] };
  }
  const codes = checkChildSafeText(output.text);
  return codes.length === 0 ? { output } : { reason: 'unsafe_output', codes };
}

/**
 * Runs one AI call and lets its answer through only if it meets the AI output contract (#6) for
 * exactly what was asked, does not give away the solution (#31), and meets the child-safety rules
 * (#11): the word lists, and the safety classifier when one is configured. It never fails: a
 * timeout, a provider error, a throwing adapter or a rejected answer all become a fallback verdict.
 */
export async function judgeAiAnswer(
  call: () => ResultAsync<unknown, HintProviderFailure>,
  expected: AiOutputRequest,
  { solution, safety }: AnswerGuards,
): Promise<Verdict> {
  try {
    const verdict = await call().match(
      (raw): Verdict =>
        validateAiOutput(raw, expected).match(
          (output): Verdict => textVerdict(output, solution),
          (rejection): Verdict => ({
            reason: 'invalid_output',
            codes: unique(Object.values(rejection.fieldErrors).flat()),
          }),
        ),
      (failure): Verdict => ({ reason: FALLBACK_BY_FAILURE[failure.kind], codes: [] }),
    );
    return 'output' in verdict && safety !== undefined
      ? await classifierVerdict(verdict.output, safety)
      : verdict;
  } catch {
    // An adapter that throws instead of returning its failure must still not leave the child without help.
    return { reason: 'provider_unavailable', codes: [] };
  }
}
