import type { ChildProfileView } from './contracts/learner-views';
import type { ChildProfile } from '../domain/models/child-profile';

export function toChildProfileView(childProfile: ChildProfile): ChildProfileView {
  return {
    id: childProfile.id,
    displayName: childProfile.displayName,
    federalState: childProfile.federalState,
    grade: childProfile.grade,
    companion: childProfile.companion,
    voiceConsent: childProfile.voiceConsent,
    createdAt: childProfile.createdAt,
    updatedAt: childProfile.updatedAt,
  };
}
