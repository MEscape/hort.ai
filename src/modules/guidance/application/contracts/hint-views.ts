import type { HintFallbackReason as DomainHintFallbackReason } from '../../domain/models/hint-fallback-reason';
import type { HintLevel } from '../../domain/models/hint-level';

/** Why the predefined prompt was used instead of the AI's answer. */
export type HintFallbackReason = DomainHintFallbackReason;

/**
 * What the child gets for one hint request: a validated AI hint, or the
 * predefined safe prompt of the requested level. A fallback carries no text;
 * presentation maps its level to the translated prompt, so the wording lives
 * in the i18n catalog and nothing unchecked can reach the child.
 */
export type HintOutcome =
  | { readonly kind: 'generated'; readonly level: HintLevel; readonly text: string }
  | { readonly kind: 'fallback'; readonly level: HintLevel; readonly reason: HintFallbackReason };

/**
 * One rung of the hint ladder (#30): the hint, which rung it is (1 is "understand the task") and
 * whether it is the top rung, where asking again brings another similar example, never the solution.
 */
export interface HintStep {
  readonly hint: HintOutcome;
  readonly step: number;
  readonly isTopStep: boolean;
}
