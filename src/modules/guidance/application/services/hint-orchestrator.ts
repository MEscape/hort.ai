import { validateAiOutput } from '../../domain/ai-output/validate-ai-output';

import type { HintRequest } from '../../domain/models/hint-request';
import type { HintProvider, HintProviderFailure } from '../../domain/ports/hint-provider.port';
import type { HintFallbackReason, HintOutcome } from '../contracts/hint-views';

export interface HintOrchestratorDependencies {
  readonly provider: HintProvider;
}

const FALLBACK_BY_FAILURE = {
  timeout: 'timeout',
  unavailable: 'provider_unavailable',
} as const satisfies Record<HintProviderFailure['kind'], HintFallbackReason>;

/**
 * Asks the AI to word a hint and only lets an answer through that passes the
 * AI output contract (#6) for a hint at the requested level. It never fails:
 * a timeout, a provider error or a rejected answer all end in the predefined
 * prompt of the requested level. The AI only suggests text; the level and
 * every state change stay with the backend.
 *
 * TODO(#31): run the solution-leak guard on the validated hint before it is returned.
 */
export class HintOrchestrator {
  constructor(private readonly deps: HintOrchestratorDependencies) {}

  async suggest(request: HintRequest): Promise<HintOutcome> {
    const { level } = request;
    const fallback = (reason: HintFallbackReason): HintOutcome => ({
      kind: 'fallback',
      level,
      reason,
    });

    try {
      return await this.deps.provider.suggest(request).match(
        (raw) =>
          validateAiOutput(raw, { kind: 'hint', hintLevel: level }).match(
            (hint): HintOutcome => ({ kind: 'generated', level, text: hint.text }),
            () => fallback('invalid_output'),
          ),
        (failure) => fallback(FALLBACK_BY_FAILURE[failure.kind]),
      );
    } catch {
      // An adapter that throws instead of returning its failure must still not leave the child without help.
      return fallback('provider_unavailable');
    }
  }
}
