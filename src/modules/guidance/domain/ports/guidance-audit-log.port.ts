import type { HintFallbackReason } from '../models/hint-fallback-reason';
import type { HintLevel } from '../models/hint-level';

/**
 * What operations must see about hints. Never the child's input or the AI's text: only the level,
 * why the fallback was used, and the stable rejection codes (#11).
 */
export interface GuidanceEvent {
  readonly type: 'guidance.hint_fallback_used';
  readonly level: HintLevel;
  readonly reason: HintFallbackReason;
  readonly codes: readonly string[];
}

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface GuidanceAuditLog {
  record(event: GuidanceEvent): void;
}
