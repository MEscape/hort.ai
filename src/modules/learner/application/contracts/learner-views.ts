import type {
  ChildProfileChangesInput,
  ChildProfileCompanion,
  ChildProfileDraftInput,
  ChildProfileFederalState,
} from '../../domain/models/child-profile';

/** A child profile for its owner. The tenant is an internal detail and is not exposed. */
export interface ChildProfileView {
  readonly id: string;
  readonly displayName: string;
  readonly federalState: ChildProfileFederalState;
  readonly grade: number;
  readonly companion: ChildProfileCompanion | null;
  readonly voiceConsent: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type CreateChildProfileInput = ChildProfileDraftInput;

export interface UpdateChildProfileInput extends ChildProfileChangesInput {
  readonly id: string;
}

export interface DeleteChildProfileInput {
  readonly id: string;
}
