import type { ConflictAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { alreadyOnboarded } from '../../domain/errors/learner-errors';
import { isSetupComplete } from '../../domain/models/child-profile';

import type { ChildProfile } from '../../domain/models/child-profile';

/** A setup step edits only an unfinished profile; a finished one is `learner.already_onboarded`. */
export function requireUnfinishedProfile<T extends { readonly childProfile: ChildProfile }>(
  loaded: T,
): AppResultAsync<T, ConflictAppError> {
  return isSetupComplete(loaded.childProfile) ? errAsync(alreadyOnboarded()) : okAsync(loaded);
}
