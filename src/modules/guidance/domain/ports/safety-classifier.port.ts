import type { ResultAsync } from '@lib/result';

import type { HintProviderFailure } from './hint-provider.port';
import type { ChildSafetyValidationCode } from '../errors/child-safety-errors';

/** How likely the text breaks each child-safety rule, from 0 to 1. Untrusted until checked. */
export type SafetyScores = Readonly<Partial<Record<ChildSafetyValidationCode, number>>>;

/**
 * A model that rates AI text against the child-safety rules (#11), as a second check after the
 * word lists. It returns scores, never text; the backend decides with a fixed threshold. An adapter
 * MUST settle within its configured timeout and report a missed deadline as `timeout`.
 */
export interface SafetyClassifier {
  classify(text: string): ResultAsync<SafetyScores, HintProviderFailure>;
}
