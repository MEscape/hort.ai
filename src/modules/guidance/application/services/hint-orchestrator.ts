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
 * for a hint at the requested level, gives away no part of the solution beyond that level (#31), and
 * then passes the child-safety rules (#11). It never fails: a timeout,
 * a provider error or a rejected answer all end in the predefined prompt of the requested level, and
 * the reason is logged with its codes, never with the text or the child's input. The AI only suggests
 * text; the level and every state change stay with the backend.
 */
export class HintOrchestrator {
  constructor(private readonly deps: HintOrchestratorDependencies) {}

  /**
   * `solutionKey` is the teacher's key when the task is an assignment (#33). It is only compared
   * against the AI's answer (#31), never passed to the AI.
   */
  async suggest(request: HintRequest, solutionKey: string | null = null): Promise<HintOutcome> {
    const { level } = request;
    const verdict = await judgeAiAnswer({
      call: () => this.deps.provider.suggest(request),
      expected: { kind: 'hint', hintLevel: level },
      solution: { task: request.task, solutionKey, answer: null },
      safety: this.deps.safety,
    });
    if ('output' in verdict) {
      return { kind: 'generated', level, text: verdict.output.text };
    }
    this.deps.audit.record({ type: 'guidance.hint_fallback_used', level, ...verdict });
    return { kind: 'fallback', level, reason: verdict.reason };
  }
}
