import type { ActorId, TenantId } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { TeacherMaterialStatement } from '../models/competency';
import type { ChildProfileId, ClassroomId } from '../models/ids';

/** Private sections, read through one owner-scoped child's current class membership. */
export interface TeacherMaterialRepository {
  list(input: {
    readonly classroomId: ClassroomId;
    readonly childProfileId: ChildProfileId;
    readonly tenantId: TenantId;
    readonly ownerId: ActorId;
    readonly limit: number;
  }): AppResultAsync<readonly TeacherMaterialStatement[], InfrastructureAppError>;
}
