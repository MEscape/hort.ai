import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { toVoiceConsentView } from '../voice-view-mappers';

import type { VoiceConsentView } from '../contracts/voice-views';
import type { VoiceDependencies } from '../voice-dependencies';

export type RevokeVoiceConsentError = AuthorizationError | InfrastructureAppError;

/**
 * The signed-in parent withdraws speech consent; from now on no recording is transcribed. Revoking
 * what was never granted, or already revoked, changes nothing and succeeds.
 */
export class RevokeVoiceConsent {
  constructor(private readonly deps: VoiceDependencies) {}

  execute(): AppResultAsync<VoiceConsentView, RevokeVoiceConsentError> {
    return this.deps.authorization.requireInTenant('voice.use').andThen((actor) => {
      const holder = { tenantId: actor.tenantId, parentId: actor.id };
      return this.deps.consents.revoke(holder, this.deps.clock.now()).map((consent) => {
        this.deps.audit.record({ type: 'voice.consent_revoked', ...holder });
        return toVoiceConsentView(consent);
      });
    });
  }
}
