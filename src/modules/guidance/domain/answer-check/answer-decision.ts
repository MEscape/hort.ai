import type { AssessmentResult } from '../ai-output/ai-output';

/**
 * A task counts as understood only once the answer was correct AND the child replied to the
 * comprehension question that follows it (#14). Session state (#17) stores both; the AI decides
 * neither.
 */
export function isTaskUnderstood(state: {
  readonly result: AssessmentResult | null;
  readonly comprehensionReplied: boolean;
}): boolean {
  return state.result === 'correct' && state.comprehensionReplied;
}
