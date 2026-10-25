import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ActorId, ChildProfileId, ParentTaskId, TenantId } from '../models/ids';
import type { ParentLearningRecords, ParentTaskWithAssignment } from '../models/parent-learning';

export interface ParentLearningScope {
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
  readonly childProfileId: ChildProfileId;
  readonly includeInsights: boolean;
  /** Most tasks or assignments returned; one more is read to detect truncation. */
  readonly recordLimit: number;
  /** Most hints, answers or questions counted per task; more makes that evidence unavailable. */
  readonly evidenceLimit: number;
}

/** Read model over existing learning tables. Each operation rechecks stored ownership. */
export interface ParentLearningRepository {
  list(
    scope: ParentLearningScope,
    period: { readonly from: string; readonly until: string },
  ): AppResultAsync<ParentLearningRecords, InfrastructureAppError>;
  findTask(
    scope: ParentLearningScope,
    id: ParentTaskId,
  ): AppResultAsync<ParentTaskWithAssignment | null, InfrastructureAppError>;
}
