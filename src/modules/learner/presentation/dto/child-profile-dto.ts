import type {
  ChildProfileFederalState,
  ChildProfileCompanion,
} from '../../application/contracts/learner-constraints';
import type { ChildProfileView } from '../../application/contracts/learner-views';

/** The JSON-safe shape Server Actions return: dates as ISO-8601 strings. */
export interface ChildProfileDto {
  readonly id: string;
  readonly displayName: string;
  readonly federalState: ChildProfileFederalState;
  readonly grade: number;
  readonly companion: ChildProfileCompanion | null;
  readonly voiceConsent: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toChildProfileDto(view: ChildProfileView): ChildProfileDto {
  return {
    id: view.id,
    displayName: view.displayName,
    federalState: view.federalState,
    grade: view.grade,
    companion: view.companion,
    voiceConsent: view.voiceConsent,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}
