import type { ResourceScope } from '@modules/auth';

import type { ChildProfile } from '../domain/models/child-profile';

/**
 * The scope authorization checks a loaded profile against. Tenant and owner are read from the
 * stored record, never from the request, which is what makes the cross-parent check a comparison
 * instead of trust. The profile's own id lets a channel bound to one child be refused a sibling.
 */
export function scopeOf(profile: ChildProfile): ResourceScope {
  return { tenantId: profile.tenantId, ownerId: profile.ownerId, childProfileId: profile.id };
}
