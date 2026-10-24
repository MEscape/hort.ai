import type { ResourceScope } from '@modules/auth';

import type { Material } from '../domain/models/material';

/** Resource authorization always uses the stored tenant and owner. */
export function scopeOf(row: Material): ResourceScope {
  return { tenantId: row.tenantId, ownerId: row.ownerId };
}
