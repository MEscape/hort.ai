import type { ActorId, TenantId } from '@modules/auth';

import type { FeedbackKind } from '../models/feedback-request';
import type { HintFallbackReason } from '../models/hint-fallback-reason';
import type { HintLevel } from '../models/hint-level';
import type { ChildProfileId } from '../models/ids';

/**
 * What operations must see about hints. Never the child's input or the AI's text: only ids, the level,
 * how a request ended, why the fallback was used, and the stable rejection codes (#11).
 */
export type GuidanceEvent =
  | {
      readonly type: 'guidance.hint_fallback_used';
      readonly level: HintLevel;
      readonly reason: HintFallbackReason;
      readonly codes: readonly string[];
    }
  | {
      readonly type: 'guidance.feedback_fallback_used';
      readonly kind: FeedbackKind;
      readonly level: HintLevel;
      readonly reason: HintFallbackReason;
      readonly codes: readonly string[];
    }
  | {
      readonly type: 'guidance.grounding_unavailable';
      readonly level: HintLevel;
      readonly code: string;
    }
  | {
      readonly type: 'guidance.hint_requested';
      readonly tenantId: TenantId;
      readonly actorId: ActorId;
      readonly childProfileId: ChildProfileId;
      readonly level: HintLevel;
      readonly outcome: 'generated' | 'fallback';
    };

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface GuidanceAuditLog {
  record(event: GuidanceEvent): void;
}
