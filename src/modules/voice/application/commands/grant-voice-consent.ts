import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { toVoiceConsentView } from '../voice-view-mappers';

import type { VoiceConsentView } from '../contracts/voice-views';
import type { VoiceDependencies } from '../voice-dependencies';

export type GrantVoiceConsentError = AuthorizationError | InfrastructureAppError;

/**
 * The signed-in parent allows their child's recordings to be sent for transcription. Granting again
 * after a revocation starts a new consent.
 */
export class GrantVoiceConsent {
  constructor(private readonly deps: VoiceDependencies) {}

  execute(): AppResultAsync<VoiceConsentView, GrantVoiceConsentError> {
    return this.deps.authorization.requireInTenant('voice.use').andThen((actor) => {
      const holder = { tenantId: actor.tenantId, parentId: actor.id };
      return this.deps.consents.grant(holder, this.deps.clock.now()).map((consent) => {
        this.deps.audit.record({ type: 'voice.consent_granted', ...holder });
        return toVoiceConsentView(consent);
      });
    });
  }
}
