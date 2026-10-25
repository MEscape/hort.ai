import type { ResourceScope } from '@modules/auth';

import type { Assignment } from '../domain/models/assignment';

/**
 * The scope authorization checks a loaded assignment against. Tenant and owner (the teacher) are
 * read from the stored record, never from the request, which is what makes "another teacher's
 * assignment" a comparison instead of trust.
 */
export function scopeOf(assignment: Assignment): ResourceScope {
  return { tenantId: assignment.tenantId, ownerId: assignment.ownerId };
}
