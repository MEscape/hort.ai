import type { HintLevel } from './hint-level';

/**
 * AI output that passed validation and may be shown to the child.
 *
 * TODO(#6): replace with the hint type of the AI output contract once #6 is
 * merged; this interim shape carries only what the orchestration needs.
 */
export interface ValidatedHint {
  readonly level: HintLevel;
  readonly text: string;
}
