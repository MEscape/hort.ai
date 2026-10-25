import { isSetupComplete } from './child-profile';

import type { ChildProfile } from './child-profile';
import type { SetupStep } from './setup-step';

export interface OnboardingState {
  readonly step: SetupStep;
  readonly profile: ChildProfile | null;
}

/**
 * The state of one parent's profiles, given oldest first. An unfinished profile wins (it is the
 * one still being set up) and reports its stored step; otherwise the oldest finished one is `done`.
 * No profile at all means the parent starts at `child`.
 */
export function onboardingStateOf(profiles: readonly ChildProfile[]): OnboardingState {
  const unfinished = profiles.find((profile) => !isSetupComplete(profile));
  if (unfinished !== undefined) {
    return { step: unfinished.setupStep, profile: unfinished };
  }
  const [finished] = profiles;
  return finished === undefined
    ? { step: 'child', profile: null }
    : { step: 'done', profile: finished };
}
