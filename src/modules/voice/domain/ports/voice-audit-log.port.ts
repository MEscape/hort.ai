import type { ActorId, TenantId } from '@modules/auth';

/** What operations must see about speech consent: who changed it, never any audio or text. */
export interface VoiceEvent {
  readonly type: 'voice.consent_granted' | 'voice.consent_revoked';
  readonly tenantId: TenantId;
  readonly parentId: ActorId;
}

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface VoiceAuditLog {
  record(event: VoiceEvent): void;
}
