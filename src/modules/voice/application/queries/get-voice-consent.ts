import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { toVoiceConsentView } from '../voice-view-mappers';

import type { VoiceConsentView } from '../contracts/voice-views';
import type { VoiceDependencies } from '../voice-dependencies';

export type GetVoiceConsentError = AuthorizationError | InfrastructureAppError;

/** Whether the signed-in parent currently allows speech input, and since when. */
export class GetVoiceConsent {
  constructor(private readonly deps: VoiceDependencies) {}

  execute(): AppResultAsync<VoiceConsentView, GetVoiceConsentError> {
    return this.deps.authorization
      .requireInTenant('voice.use')
      .andThen((actor) => this.deps.consents.find({ tenantId: actor.tenantId, parentId: actor.id }))
      .map(toVoiceConsentView);
  }
}
