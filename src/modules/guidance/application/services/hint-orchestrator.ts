import type { HintRequest } from '../../domain/models/hint-request';
import type { HintOutputValidator } from '../../domain/ports/hint-output-validator.port';
import type { HintProvider, HintProviderFailure } from '../../domain/ports/hint-provider.port';
import type { HintFallbackReason, HintOutcome } from '../contracts/hint-views';

export interface HintOrchestratorDependencies {
  readonly provider: HintProvider;
  readonly validator: HintOutputValidator;
}

const FALLBACK_BY_FAILURE = {
  timeout: 'timeout',
  unavailable: 'provider_unavailable',
} as const satisfies Record<HintProviderFailure['kind'], HintFallbackReason>;

/**
 * Asks the AI to word a hint and only lets a validated answer through.
 * It never fails: a timeout, a provider error or an answer the validator
 * rejects all end in the predefined prompt of the requested level. The AI
 * only suggests text; the level and every state change stay with the
 * backend, so an answer for another level is rejected as well.
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
          this.deps.validator.validate(raw, { level }).match(
            (hint): HintOutcome =>
              hint.level === level
                ? { kind: 'generated', level, text: hint.text }
                : fallback('invalid_output'),
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
