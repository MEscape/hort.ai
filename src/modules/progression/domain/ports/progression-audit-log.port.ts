import type { AuditedActor, TenantId } from '@modules/auth';

import type { ChildProfileId } from '../models/ids';
import type { LearningEventKind } from '../models/xp-rules';

/**
 * Business facts worth keeping. Free of content: ids, counts and codes only, never a name or any
 * other detail of the child. Every variant names its tenant, which places it in the audit trail.
 * Written only when a reward was actually stored. A channel acting for the guardian (Alexa) is named
 * as the channel (`AuditedActor`), never as the guardian.
 */
export type ProgressionEvent =
  | ({
      readonly type: 'progression.daily_reward_claimed';
      readonly tenantId: TenantId;
      readonly childProfileId: ChildProfileId;
      readonly xp: number;
      /** The level after the reward. */
      readonly level: number;
    } & AuditedActor)
  | ({
      readonly type: 'progression.xp_awarded';
      readonly tenantId: TenantId;
      readonly childProfileId: ChildProfileId;
      readonly event: LearningEventKind;
      readonly xp: number;
      /** The level after the reward. */
      readonly level: number;
    } & AuditedActor);

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface ProgressionAuditLog {
  record(event: ProgressionEvent): void;
}
