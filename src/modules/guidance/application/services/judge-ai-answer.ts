import type { ResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import { validateAiOutput } from '../../domain/ai-output/validate-ai-output';
import {
  checkChildSafeText,
  flaggedBySafetyScores,
} from '../../domain/child-safety/check-child-safe-text';
import { SAFETY_CLASSIFIER_UNAVAILABLE } from '../../domain/errors/child-safety-errors';

import type { AiOutput, AiOutputRequest } from '../../domain/ai-output/ai-output';
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

/**
 * Runs one AI call and lets its answer through only if it meets the AI output contract (#6) for
 * exactly what was asked, and then the child-safety rules (#11): the word lists, and the safety
 * classifier when one is configured. It never fails: a timeout, a provider error, a throwing
 * adapter or a rejected answer all become a fallback verdict.
 *
 * TODO(#31): run the solution-leak guard on the validated output before the safety check.
 */
export async function judgeAiAnswer(
  call: () => ResultAsync<unknown, HintProviderFailure>,
  expected: AiOutputRequest,
  safety?: SafetyClassifier,
): Promise<Verdict> {
  try {
    const verdict = await call().match(
      (raw): Verdict =>
        validateAiOutput(raw, expected).match(
          (output): Verdict => {
            const codes = checkChildSafeText(output.text);
            return codes.length === 0 ? { output } : { reason: 'unsafe_output', codes };
          },
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
