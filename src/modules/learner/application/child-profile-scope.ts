import type { ResourceScope } from '@modules/auth';

import type { ChildProfile } from '../domain/models/child-profile';

/**
 * The scope authorization checks a loaded child profile against. The tenant is
 * read from the stored record (`childProfile.tenantId`), never from the request,
 * which is what makes the cross-tenant check a comparison instead of trust.
 */
export function scopeOf(childProfile: ChildProfile): ResourceScope {
  return { tenantId: childProfile.tenantId };
}
