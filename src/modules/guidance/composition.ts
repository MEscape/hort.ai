import 'server-only';

import { HintOrchestrator } from './application/services/hint-orchestrator';
import { interimHintOutputValidator } from './infrastructure/interim/interim-hint-output-validator';

import type { HintProvider } from './domain/ports/hint-provider.port';

/**
 * The module's composition root. There is no AI provider adapter yet, so the
 * caller hands one in; the validator is always chosen here, never by the
 * caller, so no path can skip it.
 *
 * TODO(#6): wire the AI output contract's validator instead of the interim one.
 */
export function createHintOrchestrator(provider: HintProvider): HintOrchestrator {
  return new HintOrchestrator({ provider, validator: interimHintOutputValidator });
}
