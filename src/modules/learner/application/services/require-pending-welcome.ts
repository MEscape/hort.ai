import type { ConflictAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { setupIncomplete, welcomeAlreadyCompleted } from '../../domain/errors/learner-errors';
import { isSetupComplete, isWelcomeComplete } from '../../domain/models/child-profile';

import type { ChildProfile } from '../../domain/models/child-profile';

/**
 * The child's welcome edits only a profile whose setup the parent finished and whose welcome is
 * still open: before the setup it is `learner.setup_incomplete`, after the welcome
 * `learner.welcome_already_completed`.
 */
export function requirePendingWelcome<T extends { readonly childProfile: ChildProfile }>(
  loaded: T,
): AppResultAsync<T, ConflictAppError> {
  const { childProfile } = loaded;
  if (!isSetupComplete(childProfile)) {
    return errAsync(setupIncomplete());
  }
  return isWelcomeComplete(childProfile) ? errAsync(welcomeAlreadyCompleted()) : okAsync(loaded);
}
