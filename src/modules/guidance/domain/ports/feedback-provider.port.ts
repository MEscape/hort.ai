import type { ResultAsync } from '@lib/result';

import type { HintProviderFailure } from './hint-provider.port';
import type { FeedbackRequest } from '../models/feedback-request';

/**
 * The AI model that assesses the child's answer, praises it or asks a comprehension question
 * (#14). Like `HintProvider`, its answer is untrusted and returned as `unknown`; it is only used
 * after it passed the AI output contract and the child-safety rules. The same timeout duty applies.
 */
export interface FeedbackProvider {
  word(request: FeedbackRequest): ResultAsync<unknown, HintProviderFailure>;
}
