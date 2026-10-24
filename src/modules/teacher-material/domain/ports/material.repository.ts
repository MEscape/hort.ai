import type { ActorId, TenantId } from '@modules/auth';
import type { AppResultAsync } from '@lib/result';

import type { ClassroomId, TeacherMaterialId } from '../models/ids';
import type { Material, MaterialScope, MaterialStatement } from '../models/material';

export interface MaterialRepository {
  create(row: Material): AppResultAsync<Material>;
  find(id: TeacherMaterialId, ownerId: ActorId, tenantId: TenantId): AppResultAsync<Material | null>;
  list(classroomId: ClassroomId, scope: MaterialScope): AppResultAsync<readonly Material[]>;
  /** Atomic CAS: only UPLOADED can publish sections; deletion must never be undone. */
  process(row: Material, sections: readonly MaterialStatement[]): AppResultAsync<boolean>;
  /** Transactionally hide the row and remove all derived sections, before storage cleanup. */
  retire(row: Material, status: 'FAILED' | 'DELETED'): AppResultAsync<void>;
}
