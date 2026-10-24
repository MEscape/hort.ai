import type { ActorId, TenantId } from '@modules/auth';

import type { ChildProfileId } from '../models/ids';

/**
 * Business facts worth keeping. Free of content: field names and ids only,
 * never the values themselves. Adding a variant forces the sink's level
 * table to be updated.
 */
export type LearnerEvent =
  | {
      readonly type: 'child_profile.created';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly childProfileId: ChildProfileId;
    }
  | {
      readonly type: 'child_profile.updated';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly childProfileId: ChildProfileId;
      readonly changedFields: ReadonlyArray<
        'displayName' | 'federalState' | 'grade' | 'companion' | 'voiceConsent'
      >;
    }
  | {
      readonly type: 'child_profile.deleted';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly childProfileId: ChildProfileId;
    };

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface LearnerAuditLog {
  record(event: LearnerEvent): void;
}
