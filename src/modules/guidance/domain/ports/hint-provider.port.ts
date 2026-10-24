import type { ResultAsync } from '@lib/result';

import type { HintRequest } from '../models/hint-request';

/** Why the provider produced nothing. Never shown to the child: the orchestration falls back. */
export type HintProviderFailure =
  { readonly kind: 'timeout' } | { readonly kind: 'unavailable'; readonly cause?: unknown };

/**
 * The AI model that words a hint. Its answer is untrusted, so it is returned
 * as `unknown` and is only used after `HintOutputValidator` has accepted it.
 *
 * An adapter MUST settle within its configured timeout and report a missed
 * deadline as `timeout`, instead of leaving the caller waiting. It MUST tell
 * the model that it never solves the task and only gives thinking prompts.
 */
export interface HintProvider {
  suggest(request: HintRequest): ResultAsync<unknown, HintProviderFailure>;
}
