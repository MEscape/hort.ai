import type { ActorId, ChildProfileId, TenantId, TutorId } from '../models/ids';

/**
 * Business facts worth keeping. Free of content: ids, codes and flags only, never a name or any
 * other detail of the child. Every variant names its tenant, which places it in the audit trail.
 * Adding a variant forces the sink's level table and the trail policy to be updated.
 */
export type LearnerEvent =
  | {
      readonly type: 'learner.profile_created';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly childProfileId: ChildProfileId;
    }
  | {
      readonly type: 'learner.interests_saved';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly childProfileId: ChildProfileId;
      /** How many interests, not which ones. */
      readonly count: number;
    }
  | {
      readonly type: 'learner.tutor_chosen';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly childProfileId: ChildProfileId;
      /** Catalog data, not child data. */
      readonly tutorId: TutorId;
    }
  | {
      readonly type: 'learner.controls_changed';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly childProfileId: ChildProfileId;
      /** The new value when the voice setting changed, else `null`. */
      readonly voiceEnabled: boolean | null;
      /** The new value when the insights setting changed, else `null`. */
      readonly learningInsights: boolean | null;
      readonly dailyLimitChanged: boolean;
      readonly allowedWindowChanged: boolean;
    }
  | {
      readonly type: 'learner.guardian_consent_recorded';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly childProfileId: ChildProfileId;
      /** Which statement was confirmed. */
      readonly consentVersion: string;
    }
  | {
      readonly type: 'learner.voice_consent_changed';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly childProfileId: ChildProfileId;
      /** Whether speech-to-text is now allowed (#34). */
      readonly allowed: boolean;
      /** The voice notice version confirmed with it; `null` for a withdrawal. */
      readonly noticeVersion: string | null;
    }
  | {
      readonly type: 'learner.onboarding_reset';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      /** How many profiles were deleted; no names, no ids. */
      readonly deletedCount: number;
    }
  | {
      readonly type: 'learner.setup_completed';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly childProfileId: ChildProfileId;
    };

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface LearnerAuditLog {
  record(event: LearnerEvent): void;
}
