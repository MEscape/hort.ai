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

/** Replies that say "I don't know", once lower case and reduced to letters, digits and single spaces. */
const NON_ANSWERS: ReadonlySet<string> = new Set([
  'weiß nicht',
  'weiss nicht',
  'ich weiß nicht',
  'ich weiss nicht',
  'weiß ich nicht',
  'weiss ich nicht',
  'keine ahnung',
  'idk',
  'i dont know',
  'dont know',
  'no idea',
]);

/**
 * Whether a comprehension reply says nothing: only marks, a single character, or "weiß nicht".
 * Such a reply does not count as replying, so it cannot make a task understood (#14).
 */
export function isNonAnswer(reply: string): boolean {
  const words = reply
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  const compact = words.replace(/ /g, '');
  // A single digit ("7") answers a "how many" question; a single letter says nothing.
  return compact.length === 0 || /^\p{L}$/u.test(compact) || NON_ANSWERS.has(words);
}
