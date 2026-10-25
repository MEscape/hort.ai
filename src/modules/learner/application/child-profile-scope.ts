import type { ResourceScope } from '@modules/auth';

import { PARENT_EVIDENCE_LIMIT, PARENT_RECORD_LIMIT } from './learner-limits';

import type { ChildProfile } from '../domain/models/child-profile';
import type { ParentLearningScope } from '../domain/ports/parent-learning.repository';

/**
 * The scope authorization checks a loaded profile against. Tenant and owner are read from the
 * stored record, never from the request, which is what makes the cross-parent check a comparison
 * instead of trust.
 */
export function scopeOf(profile: ChildProfile): ResourceScope {
  return { tenantId: profile.tenantId, ownerId: profile.ownerId };
}

/** What the parent read model may see of this profile: stored owner and tenant, bounded reads. */
export function parentLearningScope(profile: ChildProfile): ParentLearningScope {
  return {
    childProfileId: profile.id,
    ownerId: profile.ownerId,
    tenantId: profile.tenantId,
    includeInsights: profile.controls.learningInsights,
    recordLimit: PARENT_RECORD_LIMIT,
    evidenceLimit: PARENT_EVIDENCE_LIMIT,
  };
}
