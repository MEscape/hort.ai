import type { ResourceScope } from '@modules/auth';

import type { Classroom } from '../domain/models/classroom';

/**
 * The scope authorization checks a loaded classroom against. Tenant and owner (the teacher) are
 * read from the stored record, never from the request, which is what makes "another teacher's
 * class" a comparison instead of trust.
 */
export function scopeOf(classroom: Classroom): ResourceScope {
  return { tenantId: classroom.tenantId, ownerId: classroom.ownerId };
}
