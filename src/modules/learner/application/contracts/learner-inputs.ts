/**
 * What the presentation layer hands the use cases. Plain values: the domain validates them again,
 * so a caller that skipped its own validation still cannot store anything invalid.
 */
export interface CreateChildProfileInput {
  readonly displayName: string;
  readonly federalState: string;
  readonly grade: number;
}

export interface SaveInterestsInput {
  readonly profileId: string;
  readonly interests: readonly string[];
}

export interface ChooseTutorInput {
  readonly profileId: string;
  readonly tutorId: string;
}

export interface SaveControlsInput {
  readonly profileId: string;
  readonly voiceEnabled: boolean;
  /** Minutes, one of `DAILY_LIMIT_MINUTES`; `null` for no limit. */
  readonly dailyLimitMinutes: number | null;
  /** Minutes since midnight in `LEARNER_TIME_ZONE`; `null` for any time. */
  readonly allowedWindow: { readonly fromMinute: number; readonly untilMinute: number } | null;
  readonly learningInsights: boolean;
  /** The guardian's confirmation; saving the controls is refused unless this is `true`. */
  readonly guardianConfirmed: boolean;
}

export interface CompleteSetupInput {
  readonly profileId: string;
}

/** The child's welcome edits the same two things the parent chose, so the inputs are the same. */
export type SaveChildInterestsInput = SaveInterestsInput;
export type ChooseChildTutorInput = ChooseTutorInput;
export type CompleteChildWelcomeInput = CompleteSetupInput;
