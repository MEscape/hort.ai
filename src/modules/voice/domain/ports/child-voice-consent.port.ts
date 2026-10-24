import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

export type ChildVoiceConsentError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * Whether a parent allowed their child's recordings to be sent for transcription. Answered by the
 * learner module for the signed-in parent's own child only: another parent's child, or another
 * tenant's, is an error, never `false`.
 */
export interface ChildVoiceConsent {
  voiceConsentOf(childProfileId: string): AppResultAsync<boolean, ChildVoiceConsentError>;
}
