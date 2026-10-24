import type { ResourceScope } from '@modules/auth';

import type { ChildProfile } from '../domain/models/child-profile';

/**
 * The scope authorization checks a loaded child profile against. Tenant and owner are
 * read from the stored record, never from the request,
 * which is what makes the cross-tenant and cross-parent check a comparison instead of trust.
 */
export function scopeOf(childProfile: ChildProfile): ResourceScope {
  return { tenantId: childProfile.tenantId, ownerId: childProfile.ownerId };
}
