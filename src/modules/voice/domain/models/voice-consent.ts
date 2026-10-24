import type { ActorId, TenantId } from '@modules/auth';

/** Whose consent it is: the signed-in parent, within their tenant. */
export interface VoiceConsentHolder {
  readonly tenantId: TenantId;
  readonly parentId: ActorId;
}

/**
 * A parent's explicit consent that their child's recordings may be sent for transcription. Revoking
 * keeps the row and stamps `revokedAt`; granting again starts a new `grantedAt`.
 */
export interface VoiceConsent {
  readonly grantedAt: Date;
  readonly revokedAt: Date | null;
}

/** Consent counts only when it exists and has not been revoked. */
export function isConsentGiven(consent: VoiceConsent | null): consent is VoiceConsent {
  return consent !== null && consent.revokedAt === null;
}
