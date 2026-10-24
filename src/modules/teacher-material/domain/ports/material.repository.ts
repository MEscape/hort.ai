import type { AppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { Material, MaterialScope, MaterialStatement } from '../models/material';

export interface MaterialRepository {
  create(row: Material): AppResultAsync<Material, AppError>;
  find(id: string, scope: MaterialScope): AppResultAsync<Material | null, AppError>;
  list(classroomId: string, scope: MaterialScope): AppResultAsync<readonly Material[], AppError>;
  /** Atomic CAS: only UPLOADED can publish sections; deletion must never be undone. */
  process(row: Material, sections: readonly MaterialStatement[]): AppResultAsync<boolean, AppError>;
  /** Transactionally hide the row and remove all derived sections, before storage cleanup. */
  retire(row: Material, status: 'FAILED' | 'DELETED'): AppResultAsync<void, AppError>;
}
