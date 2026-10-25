import { judgeAiAnswer } from './judge-ai-answer';

import type { HintRequest } from '../../domain/models/hint-request';
import type { GuidanceAuditLog } from '../../domain/ports/guidance-audit-log.port';
import type { HintProvider } from '../../domain/ports/hint-provider.port';
import type { SafetyClassifier } from '../../domain/ports/safety-classifier.port';
import type { HintOutcome } from '../contracts/hint-views';

export interface HintOrchestratorDependencies {
  readonly provider: HintProvider;
  readonly audit: GuidanceAuditLog;
  /** The second safety check (#11); without one only the word lists apply. */
  readonly safety?: SafetyClassifier;
}

/**
 * Asks the AI to word a hint and only lets an answer through that passes the AI output contract (#6)
 * for a hint at the requested level, does not give away the solution (#31) and then passes the
 * child-safety rules (#11). It never fails: a timeout, a provider error or a rejected answer all end
 * in the predefined prompt of the requested level, and the reason is logged with its codes, never
 * with the text or the child's input. The AI only suggests text; the level and every state change
 * stay with the backend.
 */
export class HintOrchestrator {
  constructor(private readonly deps: HintOrchestratorDependencies) {}

  async suggest(request: HintRequest): Promise<HintOutcome> {
    const { level } = request;
    const verdict = await judgeAiAnswer(
      () => this.deps.provider.suggest(request),
      { kind: 'hint', hintLevel: level },
      {
        // TODO(#33): a hint on a teacher's assignment brings its solution key; without one the guard
        // derives the candidates from the task.
        solution: { task: request.task, solutionKey: null, childAnswer: null },
        safety: this.deps.safety,
      },
    );
    if ('output' in verdict) {
      return { kind: 'generated', level, text: verdict.output.text };
    }
    this.deps.audit.record({ type: 'guidance.hint_fallback_used', level, ...verdict });
    return { kind: 'fallback', level, reason: verdict.reason };
  }
}
