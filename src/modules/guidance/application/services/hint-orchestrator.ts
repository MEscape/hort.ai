import { unique } from '@lib/utils';

import { validateAiOutput } from '../../domain/ai-output/validate-ai-output';
import { checkChildSafeText } from '../../domain/child-safety/check-child-safe-text';

import type { HintFallbackReason } from '../../domain/models/hint-fallback-reason';
import type { HintRequest } from '../../domain/models/hint-request';
import type { GuidanceAuditLog } from '../../domain/ports/guidance-audit-log.port';
import type { HintProvider, HintProviderFailure } from '../../domain/ports/hint-provider.port';
import type { HintOutcome } from '../contracts/hint-views';

export interface HintOrchestratorDependencies {
  readonly provider: HintProvider;
  readonly audit: GuidanceAuditLog;
}

const FALLBACK_BY_FAILURE = {
  timeout: 'timeout',
  unavailable: 'provider_unavailable',
} as const satisfies Record<HintProviderFailure['kind'], HintFallbackReason>;

/** Either the text to show, or why the predefined prompt is shown instead and which rules said so. */
type Verdict =
  | { readonly text: string }
  | { readonly reason: HintFallbackReason; readonly codes: readonly string[] };

/**
 * Asks the AI to word a hint and only lets an answer through that passes the AI output contract (#6)
 * for a hint at the requested level and then the child-safety rules (#11). It never fails: a timeout,
 * a provider error or a rejected answer all end in the predefined prompt of the requested level, and
 * the reason is logged with its codes, never with the text or the child's input. The AI only suggests
 * text; the level and every state change stay with the backend.
 *
 * TODO(#31): run the solution-leak guard on the validated hint before the safety check.
 */
export class HintOrchestrator {
  constructor(private readonly deps: HintOrchestratorDependencies) {}

  async suggest(request: HintRequest): Promise<HintOutcome> {
    const { level } = request;
    const verdict = await this.judge(request);
    if ('text' in verdict) {
      return { kind: 'generated', level, text: verdict.text };
    }
    this.deps.audit.record({ type: 'guidance.hint_fallback_used', level, ...verdict });
    return { kind: 'fallback', level, reason: verdict.reason };
  }

  private async judge(request: HintRequest): Promise<Verdict> {
    try {
      return await this.deps.provider.suggest(request).match(
        (raw): Verdict =>
          validateAiOutput(raw, { kind: 'hint', hintLevel: request.level }).match(
            (hint): Verdict => {
              const codes = checkChildSafeText(hint.text);
              return codes.length === 0 ? { text: hint.text } : { reason: 'unsafe_output', codes };
            },
            (rejection): Verdict => ({
              reason: 'invalid_output',
              codes: unique(Object.values(rejection.fieldErrors).flat()),
            }),
          ),
        (failure): Verdict => ({ reason: FALLBACK_BY_FAILURE[failure.kind], codes: [] }),
      );
    } catch {
      // An adapter that throws instead of returning its failure must still not leave the child without help.
      return { reason: 'provider_unavailable', codes: [] };
    }
  }
}
